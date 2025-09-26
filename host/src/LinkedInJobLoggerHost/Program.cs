using LinkedInJobLoggerHost;

class Program
{
    static async Task Main(string[] args)
    {
        var host = new NativeMessagingHost();
        await host.RunAsync();
    }
}
