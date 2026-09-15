// SPDX-License-Identifier: AGPL-3.0-or-later

#[tokio::main]
async fn main() {
    if let Err(error) = aethernet_ci::run().await {
        eprintln!("{error:?}");
        std::process::exit(1);
    }
}
