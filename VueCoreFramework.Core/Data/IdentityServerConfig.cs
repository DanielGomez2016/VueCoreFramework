﻿using IdentityModel;
using IdentityServer4;
using IdentityServer4.Models;
using System.Collections.Generic;

namespace VueCoreFramework.Core.Data
{
    /// <summary>
    /// Provides configuration for IdentityServer.
    /// </summary>
    public static class IdentityServerConfig
    {
        /// <summary>
        /// The API name for IdentityServer.
        /// </summary>
        public const string apiName = "vcfapi";

        /// <summary>
        /// The base URL for the MVC app.
        /// </summary>
        public const string mvcBaseAddress = "https://localhost:44393/";

        /// <summary>
        /// The default MVC client name for IdentityServer.
        /// </summary>
        public const string mvcClientName = "mvc.client";

        /// <summary>
        /// The base URL for the Vue app.
        /// </summary>
        public const string vueBaseAddress = "https://localhost:44393/";

        /// <summary>
        /// The default Vue client name for IdentityServer.
        /// </summary>
        public const string vueClientName = "vue.client";

        /// <summary>
        /// Obtains a list of <see cref="ApiResource"/> objects for IdentityServer.
        /// </summary>
        /// <returns>A list of <see cref="ApiResource"/> objects for IdentityServer.</returns>
        public static IEnumerable<ApiResource> GetApiResources(string secret)
            => new List<ApiResource>
            {
                new ApiResource
                {
                    Name = apiName,

                    ApiSecrets = { new Secret(secret.Sha256()) },

                    UserClaims = { JwtClaimTypes.Email }
                }
            };

        /// <summary>
        /// Obtains a list of <see cref="Client"/> objects for IdentityServer.
        /// </summary>
        /// <returns>A list of <see cref="Client"/> objects for IdentityServer.</returns>
        public static IEnumerable<Client> GetClients(string secret)
            => new List<Client>
            {
                new Client
                {
                    ClientId = mvcClientName,
                    ClientName = "MVC Client",
                    RequireConsent = false,

                    AllowedGrantTypes = GrantTypes.HybridAndClientCredentials,

                    ClientSecrets = { new Secret(secret.Sha256()) },

                    RedirectUris = { mvcBaseAddress },
                    PostLogoutRedirectUris = { mvcBaseAddress },

                    AllowedScopes = new List<string>
                    {
                        IdentityServerConstants.StandardScopes.OpenId,
                        IdentityServerConstants.StandardScopes.Profile,
                        IdentityServerConstants.StandardScopes.Email,
                        apiName
                    },
                    AllowOfflineAccess = true
                },
                new Client
                {
                    ClientId = vueClientName,
                    ClientName = "Vue Client",
                    ClientUri = vueBaseAddress,
                    RequireConsent = false,

                    AllowedGrantTypes = GrantTypes.Implicit,
                    AllowAccessTokensViaBrowser = true,

                    RedirectUris = { $"{vueBaseAddress}/oidc" },
                    PostLogoutRedirectUris = { vueBaseAddress },

                    AllowedScopes = new List<string>
                    {
                        IdentityServerConstants.StandardScopes.OpenId,
                        IdentityServerConstants.StandardScopes.Profile,
                        IdentityServerConstants.StandardScopes.Email,
                        apiName
                    }
                }
            };

        /// <summary>
        /// Obtains a list of <see cref="IdentityResource"/> objects for IdentityServer.
        /// </summary>
        /// <returns>A list of <see cref="IdentityResource"/> objects for IdentityServer.</returns>
        public static IEnumerable<IdentityResource> GetIdentityResources()
            => new List<IdentityResource>
            {
                new IdentityResources.OpenId(),
                new IdentityResources.Email(),
                new IdentityResources.Profile(),
            };
    }
}
