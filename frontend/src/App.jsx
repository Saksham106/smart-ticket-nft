import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "./contract.js";
import { formatRevertError } from "./revertError.js";

export default function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [primaryPrice, setPrimaryPrice] = useState(null);
  const [resaleCap, setResaleCap] = useState(null);
  const [maxSupply, setMaxSupply] = useState(null);
  const [totalMinted, setTotalMinted] = useState(null);
  const [status, setStatus] = useState("");

  const [statusTokenId, setStatusTokenId] = useState("");
  const [statusResult, setStatusResult] = useState("");
  /** tokenId → price ETH string while listing form is open */
  const [listPrices, setListPrices] = useState({});
  const [myTickets, setMyTickets] = useState([]);
  const [marketListings, setMarketListings] = useState([]);
  const [scanningTickets, setScanningTickets] = useState(false);

  useEffect(() => {
    if (contract) {
      loadContractData();
    }
  }, [contract]);

  /** Scan 1…totalMinted from chain — no Enumerable; OK for modest maxSupply (this demo ≤100). */
  useEffect(() => {
    if (!contract || account == null) {
      setMyTickets([]);
      setMarketListings([]);
      return;
    }
    refreshTicketCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contract/account drive rescan (reads minted live)
  }, [contract, account, totalMinted]);

  async function connectWallet() {
    try {
      if (!window.ethereum) {
        setStatus("MetaMask not found.");
        return;
      }
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const instance = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      setAccount(accounts[0]);
      setContract(instance);
      setStatus("Wallet connected.");
    } catch (error) {
      setStatus(error.message || "Wallet connection failed.");
    }
  }

  async function loadContractData() {
    try {
      const price = await contract.primaryPrice();
      const cap = await contract.resalePriceCap();
      const max = await contract.maxSupply();
      const minted = await contract.totalMinted();

      setPrimaryPrice(price);
      setResaleCap(cap);
      setMaxSupply(max);
      setTotalMinted(minted);
      await refreshTicketCatalog();
    } catch (error) {
      setStatus(formatRevertError(error) || "Failed to load contract data.");
    }
  }

  function addrEq(a, b) {
    return typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();
  }

  async function refreshTicketCatalog() {
    if (!contract || !account) {
      setMyTickets([]);
      setMarketListings([]);
      return;
    }

    let minted = 0;
    try {
      minted = Number(await contract.totalMinted());
    } catch {
      setMyTickets([]);
      setMarketListings([]);
      return;
    }

    if (!Number.isFinite(minted) || minted < 1) {
      setMyTickets([]);
      setMarketListings([]);
      return;
    }

    setScanningTickets(true);
    try {
      const owned = [];
      const listings = [];

      for (let i = 1; i <= minted; i += 1) {
        const id = BigInt(i);
        try {
          const owner = await contract.ownerOf(id);
          const redeemed = await contract.isRedeemed(id);
          const listing = await contract.getListing(id);

          if (addrEq(owner, account)) {
            owned.push({
              tokenId: String(i),
              redeemed,
              listed: listing.active,
              listedPriceEth: listing.active ? ethers.formatEther(listing.price) : ""
            });
          }

          if (listing.active && !addrEq(listing.seller, account)) {
            listings.push({
              tokenId: String(i),
              seller: listing.seller,
              priceWei: listing.price,
              priceEth: ethers.formatEther(listing.price)
            });
          }
        } catch {
          /* stray state should not occur for id ≤ totalMinted */
        }
      }

      owned.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));
      listings.sort((a, b) => Number(a.tokenId) - Number(b.tokenId));

      setMyTickets(owned);
      setMarketListings(listings);
    } finally {
      setScanningTickets(false);
    }
  }

  async function buyTicket() {
    try {
      const tx = await contract.buyTicket({ value: primaryPrice });
      await tx.wait();
      setStatus("Ticket purchased.");
      await loadContractData();
      await refreshTicketCatalog();
    } catch (error) {
      setStatus(formatRevertError(error));
    }
  }

  async function checkStatus() {
    try {
      const owner = await contract.ownerOf(statusTokenId);
      const redeemed = await contract.isRedeemed(statusTokenId);
      setStatusResult(`Owner: ${owner}\nRedeemed: ${redeemed}`);
    } catch (error) {
      setStatusResult(formatRevertError(error));
    }
  }

  async function listForResaleById(tokenIdStr) {
    const row = myTickets.find((x) => x.tokenId === tokenIdStr);
    const rawPrice = String(
      listPrices[tokenIdStr] ??
        (row?.listed ? row.listedPriceEth : "") ??
        ""
    ).trim();
    try {
      if (!rawPrice) {
        setStatus("Enter a resale price in ETH for that ticket.");
        return;
      }
      const priceWei = ethers.parseEther(rawPrice);
      const tx = await contract.listForResale(tokenIdStr, priceWei);
      await tx.wait();
      setStatus(`Ticket #${tokenIdStr} listed for resale.`);
      await refreshTicketCatalog();
    } catch (error) {
      setStatus(formatRevertError(error));
    }
  }

  function setTicketListPrice(tokenIdStr, value) {
    setListPrices((prev) => ({ ...prev, [tokenIdStr]: value }));
  }

  async function buyResaleById(tokenIdStr) {
    try {
      const listing = await contract.getListing(tokenIdStr);
      const tx = await contract.buyResale(tokenIdStr, { value: listing.price });
      await tx.wait();
      setStatus(`Purchased resale ticket #${tokenIdStr}.`);
      await loadContractData();
      await refreshTicketCatalog();
    } catch (error) {
      setStatus(formatRevertError(error));
    }
  }

  async function redeemTicketById(tokenIdStr) {
    try {
      const tokenId = BigInt(tokenIdStr);
      await contract.ownerOf(tokenId);
      await contract.redeem.staticCall(tokenId);
      const tx = await contract.redeem(tokenId);
      await tx.wait();
      setStatus(`Ticket #${tokenIdStr} redeemed.`);
      await loadContractData();
      await refreshTicketCatalog();
    } catch (error) {
      setStatus(formatRevertError(error));
    }
  }

  const unredeemedMyTickets = myTickets.filter((t) => !t.redeemed);

  return (
    <div className="app">
      <h1>NFT Ticketing Demo</h1>

      <section>
        <h2>Connect Wallet</h2>
        <button onClick={connectWallet}>Connect</button>
        <div className="status">Account: {account || "Not connected"}</div>
      </section>

      <section>
        <h2>Contract Info</h2>
        <button type="button" onClick={() => loadContractData()} disabled={!contract}>
          Refresh contract and catalogs
        </button>
        <div>
          Primary Price: {primaryPrice != null ? ethers.formatEther(primaryPrice) : "-"} ETH
        </div>
        <div>Resale Cap: {resaleCap != null ? ethers.formatEther(resaleCap) : "-"} ETH</div>
        <div>
          Supply:{" "}
          {totalMinted != null ? String(totalMinted) : "-"} /{" "}
          {maxSupply != null ? String(maxSupply) : "-"}
        </div>
      </section>

      <section>
        <h2>Buy Ticket</h2>
        <button onClick={buyTicket} disabled={!contract || primaryPrice == null}>Buy Ticket</button>
      </section>

      <section>
        <h2>View Ticket Status</h2>
        <input
          placeholder="Token ID"
          value={statusTokenId}
          onChange={(event) => setStatusTokenId(event.target.value)}
        />
        <button onClick={checkStatus} disabled={!contract || !statusTokenId}>Check</button>
        <div className="status">{statusResult}</div>
      </section>

      <section>
        <h2>List ticket for resale</h2>
        <p className="hint">
          Tickets owned by your wallet are listed below. Enter a resale price ≤ cap ({resaleCap != null ? ethers.formatEther(resaleCap) : "?"} ETH).
        </p>
        {scanningTickets && <div className="status">Refreshing your tickets…</div>}
        {!contract || !account ? (
          <div className="status">Connect a wallet.</div>
        ) : myTickets.length === 0 ? (
          <div className="status">No tickets in this wallet (or supply is 0).</div>
        ) : (
          <ul className="ticket-catalog">
            {myTickets.map((t) => (
              <li key={`list-${t.tokenId}`}>
                <span className="ticket-catalog__meta">
                  <strong>#{t.tokenId}</strong>
                  {t.redeemed ? " · redeemed " : ""}
                  {t.listed ? " · already listed " : ""}
                </span>
                {!t.redeemed ? (
                  <span className="ticket-catalog__actions">
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Price (ETH)"
                      value={
                        listPrices[t.tokenId] ??
                        (t.listed ? t.listedPriceEth : "")
                      }
                      onChange={(e) => setTicketListPrice(t.tokenId, e.target.value)}
                      aria-label={`Resale price for token ${t.tokenId}`}
                    />
                    <button type="button" onClick={() => listForResaleById(t.tokenId)}>
                      {t.listed ? "Update listing" : "List"}
                    </button>
                  </span>
                ) : (
                  <span className="status">Cannot list a redeemed ticket.</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Buy resale ticket</h2>
        <p className="hint">
          Active resale listings by other wallets on this contract ({marketListings.length}).
        </p>
        {!contract ? (
          <div className="status">Connect a wallet.</div>
        ) : marketListings.length === 0 ? (
          <div className="status">No resale listings from other wallets right now.</div>
        ) : (
          <ul className="ticket-catalog ticket-catalog--wide">
            {marketListings.map((row) => (
              <li key={`buy-${row.tokenId}`}>
                <span className="ticket-catalog__meta">
                  <strong>#{row.tokenId}</strong> · Seller {row.seller.slice(0, 6)}…{row.seller.slice(-4)}
                </span>
                <span className="ticket-catalog__actions">
                  <span>{row.priceEth} ETH</span>
                  <button type="button" onClick={() => buyResaleById(row.tokenId)}>
                    Buy
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Check-in (ticket holder)</h2>
        <p className="hint">
          Organizer can verify <code>isRedeemed</code> before and after you tap Redeem.
        </p>
        {!contract || !account ? (
          <div className="status">Connect the wallet that holds the ticket.</div>
        ) : unredeemedMyTickets.length === 0 ? (
          <div className="status">No unredeemed tickets in this wallet.</div>
        ) : (
          <ul className="ticket-catalog">
            {unredeemedMyTickets.map((t) => (
              <li key={`redeem-${t.tokenId}`}>
                <span className="ticket-catalog__meta">
                  <strong>#{t.tokenId}</strong>
                </span>
                <button type="button" onClick={() => redeemTicketById(t.tokenId)}>
                  Redeem at gate
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Status</h2>
        <div className="status">{status}</div>
      </section>
    </div>
  );
}
