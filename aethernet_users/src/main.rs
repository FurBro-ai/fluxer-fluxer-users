// SPDX-License-Identifier: AGPL-3.0-or-later

mod router_impl;
mod shard_impl;
mod types;

use aethernet_svc::config::{DatabaseBackend, Mode, ServiceConfig};
use aethernet_svc::transport::NatsTransport;
use router_impl::UsersRouter;
use shard_impl::UsersShard;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    aethernet_svc::init_tracing();
    let config = ServiceConfig::from_env()?;
    let transport =
        NatsTransport::connect(&config.nats_url, config.nats_auth_token.as_deref()).await?;

    tracing::info!(
        service = config.service_name,
        mode = ?config.mode,
        shard_id = config.shard_id,
        shard_count = config.shard_count,
        listen_addr = %config.listen_addr,
        "starting users service"
    );

    match config.mode {
        Mode::Router => aethernet_svc::router::run_router(&config, UsersRouter, transport).await,
        Mode::Shard => {
            let shard = match config.database_backend {
                DatabaseBackend::Postgres => {
                    let postgres_config =
                        aethernet_svc::postgres::PostgresConfig::from_service_config(&config);
                    let pool = aethernet_svc::postgres::connect(&postgres_config).await?;
                    let kv = aethernet_svc::postgres::KvClient::new(pool, &postgres_config)?;
                    UsersShard::new_postgres(kv, config.cache_max_entries, config.cache_ttl)
                }
                DatabaseBackend::Cassandra => {
                    #[cfg(feature = "scylla")]
                    {
                        let scylla_config =
                            aethernet_svc::scylla::ScyllaConfig::from_service_config(&config);
                        let db = aethernet_svc::scylla::connect(&scylla_config).await?;
                        UsersShard::new_scylla(db, config.cache_max_entries, config.cache_ttl)
                            .await?
                    }
                    #[cfg(not(feature = "scylla"))]
                    {
                        anyhow::bail!(
                            "AETHERNET_DATABASE_BACKEND=cassandra requires the scylla feature"
                        );
                    }
                }
            };
            aethernet_svc::shard::run_shard(&config, shard, transport).await
        }
    }
}
