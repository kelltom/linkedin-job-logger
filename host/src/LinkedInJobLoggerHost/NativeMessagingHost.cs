using System.Diagnostics.CodeAnalysis;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace LinkedInJobLoggerHost
{
    public class NativeMessagingHost
    {
        private readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        public async Task RunAsync()
        {
            try
            {
                while (true)
                {
                    var message = await ReadMessageAsync();
                    if (message == null) break;

                    var response = await ProcessMessageAsync(message);
                    await WriteMessageAsync(response);
                }
            }
            catch (Exception ex)
            {
                // Log error to file for debugging
                await LogErrorAsync(ex);
            }
        }

        private async Task<string?> ReadMessageAsync()
        {
            try
            {
                var stdin = Console.OpenStandardInput();
                var lengthBytes = new byte[4];
                
                var bytesRead = await stdin.ReadAsync(lengthBytes, 0, 4);
                if (bytesRead != 4) return null;

                var messageLength = BitConverter.ToInt32(lengthBytes, 0);
                if (messageLength <= 0 || messageLength > 1024 * 1024) return null; // Max 1MB

                var messageBytes = new byte[messageLength];
                var totalBytesRead = 0;
                
                while (totalBytesRead < messageLength)
                {
                    var remaining = messageLength - totalBytesRead;
                    var read = await stdin.ReadAsync(messageBytes, totalBytesRead, remaining);
                    if (read == 0) return null;
                    totalBytesRead += read;
                }

                return Encoding.UTF8.GetString(messageBytes);
            }
            catch
            {
                return null;
            }
        }

        [UnconditionalSuppressMessage("Trimming", "IL2026:Members annotated with 'RequiresUnreferencedCodeAttribute' require dynamic access otherwise can break functionality when trimming application code", Justification = "Trimming is disabled for this application")]
        [UnconditionalSuppressMessage("AOT", "IL3050:Calling members annotated with 'RequiresDynamicCodeAttribute' may break functionality when AOT compiling", Justification = "AOT is not used for this application")]
        private async Task WriteMessageAsync(object message)
        {
            try
            {
                var json = JsonSerializer.Serialize(message, _jsonOptions);
                var bytes = Encoding.UTF8.GetBytes(json);
                var lengthBytes = BitConverter.GetBytes(bytes.Length);

                var stdout = Console.OpenStandardOutput();
                await stdout.WriteAsync(lengthBytes, 0, 4);
                await stdout.WriteAsync(bytes, 0, bytes.Length);
                await stdout.FlushAsync();
            }
            catch (Exception ex)
            {
                await LogErrorAsync(ex);
            }
        }

        [UnconditionalSuppressMessage("Trimming", "IL2026:Members annotated with 'RequiresUnreferencedCodeAttribute' require dynamic access otherwise can break functionality when trimming application code", Justification = "Trimming is disabled for this application")]
        [UnconditionalSuppressMessage("AOT", "IL3050:Calling members annotated with 'RequiresDynamicCodeAttribute' may break functionality when AOT compiling", Justification = "AOT is not used for this application")]
        private async Task<object> ProcessMessageAsync(string messageJson)
        {
            try
            {
                var envelope = JsonSerializer.Deserialize<MessageEnvelope>(messageJson, _jsonOptions);
                if (envelope == null)
                {
                    return CreateErrorResponse("", "INVALID_MESSAGE", "Invalid message format");
                }

                return envelope.Kind?.ToLower() switch
                {
                    "ping" => CreatePingResponse(envelope.RequestId),
                    "createjobpacket" => await ProcessCreateJobPacketAsync(envelope),
                    "openfolder" => await ProcessOpenFolderAsync(envelope),
                    _ => CreateErrorResponse(envelope.RequestId, "UNKNOWN_KIND", $"Unknown message kind: {envelope.Kind}")
                };
            }
            catch (JsonException)
            {
                return CreateErrorResponse("", "JSON_PARSE_ERROR", "Failed to parse JSON message");
            }
            catch (Exception ex)
            {
                await LogErrorAsync(ex);
                return CreateErrorResponse("", "INTERNAL_ERROR", "Internal server error");
            }
        }

        [UnconditionalSuppressMessage("Trimming", "IL2026:Members annotated with 'RequiresUnreferencedCodeAttribute' require dynamic access otherwise can break functionality when trimming application code", Justification = "Trimming is disabled for this application")]
        [UnconditionalSuppressMessage("AOT", "IL3050:Calling members annotated with 'RequiresDynamicCodeAttribute' may break functionality when AOT compiling", Justification = "AOT is not used for this application")]
        private async Task<object> ProcessCreateJobPacketAsync(MessageEnvelope envelope)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<CreateJobPacketPayload>(
                    ((JsonElement)envelope.Payload).GetRawText(), _jsonOptions);
                
                if (payload == null)
                {
                    return CreateErrorResponse(envelope.RequestId, "INVALID_PAYLOAD", "Invalid payload");
                }

                // Validate required fields
                if (string.IsNullOrWhiteSpace(payload.Title))
                {
                    return CreateErrorResponse(envelope.RequestId, "MISSING_TITLE", "Job title is required");
                }

                if (string.IsNullOrWhiteSpace(payload.Company))
                {
                    return CreateErrorResponse(envelope.RequestId, "MISSING_COMPANY", "Company name is required");
                }

                if (string.IsNullOrWhiteSpace(payload.BaseFolder))
                {
                    return CreateErrorResponse(envelope.RequestId, "BASE_PATH_MISSING", "Base folder path is required");
                }

                // Create job folder
                var folderName = SanitizeFolderName(payload.FolderName ?? GenerateFolderName(payload.Company, payload.Title));
                var jobFolder = await CreateJobFolderAsync(payload.BaseFolder, folderName);

                // Generate HTML file
                var htmlPath = Path.Combine(jobFolder, "ad.html");
                await GeneratePdfAsync(payload, htmlPath); // Method name kept for compatibility
                
                return new
                {
                    RequestId = envelope.RequestId,
                    Ok = true,
                    FolderPath = jobFolder,
                    PdfPath = htmlPath, // Return HTML path for compatibility
                    Warnings = new List<string>()
                };
            }
            catch (DirectoryNotFoundException)
            {
                return CreateErrorResponse(envelope.RequestId, "BASE_PATH_NOT_FOUND", "Base folder path does not exist");
            }
            catch (UnauthorizedAccessException)
            {
                return CreateErrorResponse(envelope.RequestId, "ACCESS_DENIED", "Access denied to base folder path");
            }
            catch (IOException ex)
            {
                return CreateErrorResponse(envelope.RequestId, "FOLDER_CREATE_FAILED", $"Failed to create folder: {ex.Message}");
            }
            catch (Exception ex)
            {
                await LogErrorAsync(ex);
                return CreateErrorResponse(envelope.RequestId, "PDF_RENDER_FAILED", $"Failed to generate PDF: {ex.Message}");
            }
        }

        [UnconditionalSuppressMessage("Trimming", "IL2026:Members annotated with 'RequiresUnreferencedCodeAttribute' require dynamic access otherwise can break functionality when trimming application code", Justification = "Trimming is disabled for this application")]
        [UnconditionalSuppressMessage("AOT", "IL3050:Calling members annotated with 'RequiresDynamicCodeAttribute' may break functionality when AOT compiling", Justification = "AOT is not used for this application")]
        private async Task<object> ProcessOpenFolderAsync(MessageEnvelope envelope)
        {
            try
            {
                var payload = JsonSerializer.Deserialize<OpenFolderPayload>(
                    ((JsonElement)envelope.Payload).GetRawText(), _jsonOptions);
                
                if (payload?.Path != null && Directory.Exists(payload.Path))
                {
                    System.Diagnostics.Process.Start("explorer.exe", payload.Path);
                }

                return new
                {
                    RequestId = envelope.RequestId,
                    Ok = true
                };
            }
            catch (Exception ex)
            {
                await LogErrorAsync(ex);
                return CreateErrorResponse(envelope.RequestId, "OPEN_FOLDER_FAILED", ex.Message);
            }
        }

        private string GenerateFolderName(string company, string title)
        {
            var date = DateTime.Now.ToString("yyyy-MM-dd");
            return $"{date} {company} - {title}";
        }

        private string SanitizeFolderName(string folderName)
        {
            if (string.IsNullOrWhiteSpace(folderName)) return "UnknownJob";

            // Replace invalid characters
            var invalidChars = new char[] { '<', '>', ':', '"', '/', '\\', '|', '?', '*' };
            var sanitized = folderName;
            
            foreach (var c in invalidChars)
            {
                sanitized = sanitized.Replace(c, '_');
            }

            // Normalize whitespace
            sanitized = Regex.Replace(sanitized, @"\s+", " ").Trim();
            
            // Limit length
            if (sanitized.Length > 150)
            {
                sanitized = sanitized.Substring(0, 150).Trim();
            }

            return sanitized;
        }

        private Task<string> CreateJobFolderAsync(string basePath, string folderName)
        {
            if (!Directory.Exists(basePath))
            {
                throw new DirectoryNotFoundException($"Base path does not exist: {basePath}");
            }

            var targetPath = Path.Combine(basePath, folderName);
            var counter = 1;
            var originalPath = targetPath;

            // Handle duplicates
            while (Directory.Exists(targetPath))
            {
                counter++;
                targetPath = $"{originalPath} ({counter})";
            }

            Directory.CreateDirectory(targetPath);
            return Task.FromResult(targetPath);
        }

        private async Task GeneratePdfAsync(CreateJobPacketPayload payload, string pdfPath)
        {
            // Generate HTML content only (self-contained and offline-ready)
            var html = GenerateHtmlContent(payload);
            var htmlPath = Path.ChangeExtension(pdfPath, ".html");
            await File.WriteAllTextAsync(htmlPath, html, Encoding.UTF8);
        }

        private string GenerateHtmlContent(CreateJobPacketPayload payload)
        {
            return $@"<!DOCTYPE html>
<html>
<head>
    <meta charset='utf-8'>
    <title>Job Application - {payload.Title}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }}
        .header {{ border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }}
        .title {{ font-size: 24px; font-weight: bold; color: #333; }}
        .company {{ font-size: 18px; color: #666; margin: 5px 0; }}
        .metadata {{ background: #f5f5f5; padding: 10px; margin: 20px 0; border-left: 4px solid #0073b1; }}
        .metadata-item {{ margin: 5px 0; }}
        .content {{ margin: 20px 0; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666; }}
    </style>
</head>
<body>
    <div class='header'>
        <div class='title'>{EscapeHtml(payload.Title)}</div>
        <div class='company'>{EscapeHtml(payload.Company)}</div>
        {(string.IsNullOrEmpty(payload.Location) ? "" : $"<div>{EscapeHtml(payload.Location)}</div>")}
        {(string.IsNullOrEmpty(payload.Pay) ? "" : $"<div><strong>Pay:</strong> {EscapeHtml(payload.Pay)}</div>")}
    </div>

    <div class='metadata'>
        <div class='metadata-item'><strong>Captured:</strong> {payload.CapturedAtIso}</div>
        <div class='metadata-item'><strong>Source:</strong> <a href='{payload.SourceUrl}'>{payload.SourceUrl}</a></div>
        {(string.IsNullOrEmpty(payload.PostedAge) ? "" : $"<div class='metadata-item'><strong>Posted:</strong> {EscapeHtml(payload.PostedAge)}</div>")}
        {(string.IsNullOrEmpty(payload.Applicants) ? "" : $"<div class='metadata-item'><strong>Applicants:</strong> {EscapeHtml(payload.Applicants)}</div>")}
    </div>

    <div class='content'>
        <h2>Job Description</h2>
        {payload.DescriptionHtml}
    </div>

    <div class='footer'>
        Generated by LinkedIn Job Logger on {DateTime.Now:yyyy-MM-dd HH:mm:ss}
    </div>
</body>
</html>";
        }



        private string EscapeHtml(string? text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            return text.Replace("&", "&amp;")
                      .Replace("<", "&lt;")
                      .Replace(">", "&gt;")
                      .Replace("\"", "&quot;")
                      .Replace("'", "&#39;");
        }

        private string StripHtml(string html)
        {
            if (string.IsNullOrEmpty(html)) return "";
            return Regex.Replace(html, "<.*?>", " ")
                       .Replace("&nbsp;", " ")
                       .Replace("&amp;", "&")
                       .Replace("&lt;", "<")
                       .Replace("&gt;", ">")
                       .Replace("&quot;", "\"")
                       .Replace("&#39;", "'");
        }

        private object CreatePingResponse(string requestId)
        {
            return new
            {
                RequestId = requestId,
                Ok = true,
                Message = "Native host is responding",
                Version = "1.0"
            };
        }

        private object CreateErrorResponse(string requestId, string errorCode, string message)
        {
            return new
            {
                RequestId = requestId,
                Ok = false,
                ErrorCode = errorCode,
                Message = message
            };
        }

        private async Task LogErrorAsync(Exception ex)
        {
            try
            {
                var logPath = Path.Combine(Path.GetTempPath(), "linkedin_job_logger_error.log");
                var logEntry = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] ERROR: {ex}\n";
                await File.AppendAllTextAsync(logPath, logEntry);
            }
            catch
            {
                // Ignore logging errors
            }
        }
    }

    // Data models
    public class MessageEnvelope
    {
        public string Version { get; set; } = "";
        public string Kind { get; set; } = "";
        public string RequestId { get; set; } = "";
        public object Payload { get; set; } = new();
    }

    public class CreateJobPacketPayload
    {
        public string SourceUrl { get; set; } = "";
        public string CapturedAtIso { get; set; } = "";
        public string Title { get; set; } = "";
        public string Company { get; set; } = "";
        public string? Location { get; set; }
        public string? Pay { get; set; }
        public string? PostedAge { get; set; }
        public string? Applicants { get; set; }
        public string? DescriptionHtml { get; set; }
        public string BaseFolder { get; set; } = "";
        public string? FolderName { get; set; }
        public string? PdfFileName { get; set; }
    }

    public class OpenFolderPayload
    {
        public string? Path { get; set; }
    }
}