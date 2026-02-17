using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using StrataAudit.Functions.Services;

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices(services =>
    {
        services.AddSingleton<IAuditReviewService, AuditReviewService>();
        services.AddSingleton<UserInstructionBuilder>();
        services.AddSingleton<ICosmosDbService, CosmosDbService>();
        services.AddSingleton<IBlobStorageService, BlobStorageService>();
    })
    .Build();

host.Run();
