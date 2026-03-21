const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImI5MDI3YjY3LWFmNjctNDdjOS04Yzk5LTIxOGNiYjJiYjM3OSIsIm9yZ0lkIjoiNTA2MzI5IiwidXNlcklkIjoiNTIwOTgzIiwidHlwZSI6IlBST0pFQ1QiLCJ0eXBlSWQiOiIxODQ0OTQ3Yi0yMjIzLTQ3ZTYtOGY0Zi1jNjA1MjM4YzBjODQiLCJpYXQiOjE3NzQwODc0MzIsImV4cCI6NDkyOTg0NzQzMn0.cjYOTsQMT1hd8FRrHwVgpsXoViJnS6fDk-cValQ-e64"; 

// Elements

const walletInput = document.getElementById("walletAddress");

const chainSelect = document.getElementById("chainSelect");

const checkWalletBtn = document.getElementById("checkWallet");

const inputSection = document.getElementById("inputSection");

const totalBalanceEl = document.getElementById("totalBalance");

const priceChangeEl = document.getElementById("priceChange");

const tokenListEl = document.getElementById("tokenList");

const txListEl = document.getElementById("txList");

const nftGalleryEl = document.getElementById("nftGallery");

const exportCSVBtn = document.getElementById("exportCSV");

// Tabs logic

const tabButtons = document.querySelectorAll(".tabButton");

const tabContents = document.querySelectorAll(".tabContent");

tabButtons.forEach(btn => {

    btn.addEventListener("click", () => {

        const targetTab = btn.dataset.tab;

        tabButtons.forEach(b => b.classList.remove("active"));

        btn.classList.add("active");

        tabContents.forEach(tc => tc.classList.remove("active"));

        document.getElementById(targetTab).classList.add("active");

        if (inputSection) inputSection.style.display = targetTab === "home" ? "block" : "none";

    });

});

// 1. IMPROVED PRICE FETCH (Fixes BSC/Polygon Errors)

async function getPriceData(chain) {

    const idMap = { 

        "eth": "ethereum", 

        "bsc": "binancecoin", 

        "polygon": "matic-network" 

    };

    const fallbacks = { "eth": 2600, "bsc": 580, "polygon": 1.1 };

    

    try {

        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${idMap[chain]}&vs_currencies=usd&include_24hr_change=true`);

        const data = await response.json();

        return {

            usd: data[idMap[chain]]?.usd || fallbacks[chain],

            change: data[idMap[chain]]?.usd_24h_change || 0

        };

    } catch (err) {

        console.warn("CoinGecko failed, using fallback prices.");

        return { usd: fallbacks[chain], change: 0 };

    }

}

function fixIpfsUrl(url) {

    if (!url) return "https://via.placeholder.com/150?text=No+Image";

    return url.startsWith("ipfs://") ? url.replace("ipfs://", "https://ipfs.io/ipfs/") : url;

}

checkWalletBtn.addEventListener("click", async () => {

    const wallet = walletInput.value.trim().toLowerCase();

    const selectedChain = chainSelect.value;

    

    if (!wallet) return alert("Enter wallet address");

    // Reset UI

    totalBalanceEl.textContent = "Loading...";

    if (priceChangeEl) priceChangeEl.textContent = "";

    tokenListEl.innerHTML = "<li>Loading...</li>";

    txListEl.innerHTML = "<li>Loading...</li>";

    nftGalleryEl.innerHTML = "<p>Loading...</p>";

    if (selectedChain === "solana") {

        totalBalanceEl.textContent = "Solana integration required";

        return;

    }

    try {

        // Fetch everything in parallel to prevent timeout errors

        const [resBal, priceData, resTok, resTx, resNft] = await Promise.all([

            fetch(`https://deep-index.moralis.io/api/v2/${wallet}/balance?chain=${selectedChain}`, { headers: { "X-API-Key": MORALIS_API_KEY } }).then(r => r.json()),

            getPriceData(selectedChain),

            fetch(`https://deep-index.moralis.io/api/v2/${wallet}/erc20?chain=${selectedChain}`, { headers: { "X-API-Key": MORALIS_API_KEY } }).then(r => r.json()),

            fetch(`https://deep-index.moralis.io/api/v2/${wallet}?chain=${selectedChain}`, { headers: { "X-API-Key": MORALIS_API_KEY } }).then(r => r.json()),

            fetch(`https://deep-index.moralis.io/api/v2/${wallet}/nft?chain=${selectedChain}&media_items=true`, { headers: { "X-API-Key": MORALIS_API_KEY } }).then(r => r.json())

        ]);

        // 1. Balance Calculation

        const balance = (resBal.balance / 1e18) || 0;

        const totalUSD = balance * priceData.usd;

        totalBalanceEl.textContent = `$${totalUSD.toLocaleString(undefined, {minimumFractionDigits: 2})}`;

        if (priceChangeEl) {

            priceChangeEl.style.color = priceData.change >= 0 ? "#4CAF50" : "#ff5252";

            priceChangeEl.innerHTML = `${priceData.change >= 0 ? '▲' : '▼'} ${priceData.change.toFixed(2)}% (24h)`;

        }

        // 2. Token Display

        tokenListEl.innerHTML = resTok.length ? "" : "<li>No tokens found</li>";

        resTok.forEach(token => {

            const amount = token.balance / Math.pow(10, token.decimals);

            const li = document.createElement("li");

            li.innerHTML = `<strong>${token.symbol}</strong>: ${amount.toFixed(4)}`;

            tokenListEl.appendChild(li);

        });

        // 3. Transactions Display

        txListEl.innerHTML = resTx.result?.length ? "" : "<li>No transactions</li>";

        if (resTx.result) {

            resTx.result.slice(0, 15).forEach(tx => {

                const li = document.createElement("li");

                li.innerHTML = explainTransaction(tx, wallet, selectedChain);

                txListEl.appendChild(li);

            });

        }

        // 4. NFT Display

        nftGalleryEl.innerHTML = resNft.result?.length ? "" : "<p>No NFTs</p>";

        if (resNft.result) {

            resNft.result.forEach(nft => {

                const img = document.createElement("img");

                let imageUrl = nft.media?.preview_url || null;

                if (!imageUrl && nft.metadata) {

                    try { const meta = JSON.parse(nft.metadata); imageUrl = meta.image || meta.image_url; } catch (e) {}

                }

                img.src = fixIpfsUrl(imageUrl);

                img.onerror = () => { img.src = "https://via.placeholder.com/150?text=Error"; };

                nftGalleryEl.appendChild(img);

            });

        }

    } catch (err) { 

        console.error(err); 

        totalBalanceEl.textContent = "Network error. Check API key.";

    }

});

function explainTransaction(tx, userAddress, chain) {

    const isOut = tx.from_address.toLowerCase() === userAddress.toLowerCase();

    const value = (tx.value / 1e18).toFixed(4);

    let typeIcon = isOut ? "🔴" : "🟢";

    if (tx.input && tx.input !== "0x") return `${typeIcon} <strong>SMC Move:</strong> Interaction on ${chain.toUpperCase()}`;

    return `${typeIcon} <strong>${isOut ? 'Sent' : 'Received'}:</strong> ${value} ${chain.toUpperCase()}`;

}

// CSV Export

if (exportCSVBtn) {

    exportCSVBtn.addEventListener("click", () => {

        let csv = "Asset,Amount\n";

        document.querySelectorAll("#tokenList li").forEach(li => {

            csv += `${li.textContent.replace(/[:()$]/g, ',')}\n`;

        });

        const blob = new Blob([csv], {type: "text/csv"});

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url; a.download = `SMC_Wallet_Report.csv`; a.click();

    });

}

