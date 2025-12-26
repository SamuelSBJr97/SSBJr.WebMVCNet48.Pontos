# escape=`
FROM mcr.microsoft.com/dotnet/framework/sdk:4.8 AS build
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop';"]

WORKDIR C:\src

COPY ["SSBJr.WebMVCNet48.Pontos.sln", "."]
COPY ["SSBJr.WebMVCNet48.Pontos/SSBJr.WebNet48.Pontos.csproj", "SSBJr.WebMVCNet48.Pontos/"]

RUN nuget restore SSBJr.WebMVCNet48.Pontos.sln

COPY . .

RUN New-Item -ItemType Directory -Force -Path C:\out\app | Out-Null; `
    New-Item -ItemType Directory -Force -Path C:\out\bin | Out-Null

RUN msbuild .\SSBJr.WebMVCNet48.Pontos\SSBJr.WebNet48.Pontos.csproj `
    /p:Configuration=Release `
    /p:DeployOnBuild=true `
    /p:WebProjectOutputDir=C:\out\app\ `
    /p:OutDir=C:\out\bin\

FROM mcr.microsoft.com/dotnet/framework/aspnet:4.8 AS runtime
SHELL ["powershell", "-Command", "$ErrorActionPreference = 'Stop';"]

WORKDIR C:\inetpub\wwwroot

COPY --from=build C:\out\app\ .
