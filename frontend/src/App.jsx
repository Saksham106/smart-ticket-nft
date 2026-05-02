import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "./contract.js";

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
  const [listTokenId, setListTokenId] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [buyResaleTokenId, setBuyResaleTokenId] = useState("");
  const [redeemTokenId, setRedeemTokenId] = useState("");

  useEffect(() => {
    if (contract) {
      loadContractData();
    }
  }, [contract]);

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
    } catch (error) {
      setStatus(error.message || "Failed to load contract data.");
    }
  }

  async function buyTicket() {
    try {
      const tx = await contract.buyTicket({ value: primaryPrice });
      await tx.wait();
      setStatus("Ticket purchased.");
      await loadContractData();
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function checkStatus() {
    try {
      const owner = await contract.ownerOf(statusTokenId);
      const redeemed = await contract.isRedeemed(statusTokenId);
      setStatusResult(`Owner: ${owner}\nRedeemed: ${redeemed}`);
    } catch (error) {
      setStatusResult(error.shortMessage || error.message);
    }
  }

  async function listForResale() {
    try {
      const priceWei = ethers.parseEther(listPrice || "0");
      const tx = await contract.listForResale(listTokenId, priceWei);
      await tx.wait();
      setStatus("Ticket listed for resale.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function buyResale() {
    try {
      const listing = await contract.getListing(buyResaleTokenId);
      const tx = await contract.buyResale(buyResaleTokenId, { value: listing.price });
      await tx.wait();
      setStatus("Resale ticket purchased.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

  async function redeemTicket() {
    try {
      const tx = await contract.redeem(redeemTokenId);
      await tx.wait();
      setStatus("Ticket redeemed.");
    } catch (error) {
      setStatus(error.shortMessage || error.message);
    }
  }

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
        <div>Primary Price: {primaryPrice ? ethers.formatEther(primaryPrice) : "-"} ETH</div>
        <div>Resale Cap: {resaleCap ? ethers.formatEther(resaleCap) : "-"} ETH</div>
        <div>Supply: {totalMinted ?? "-"} / {maxSupply ?? "-"}</div>
      </section>

      <section>
        <h2>Buy Ticket</h2>
        <button onClick={buyTicket} disabled={!contract || !primaryPrice}>Buy Ticket</button>
      </section>

      <section>
        <h2>View My Ticket Status</h2>
        <input
          placeholder="Token ID"
          value={statusTokenId}
          onChange={(event) => setStatusTokenId(event.target.value)}
        />
        <button onClick={checkStatus} disabled={!contract || !statusTokenId}>Check</button>
        <div className="status">{statusResult}</div>
      </section>

      <section>
        <h2>List Ticket For Resale</h2>
        <input
          placeholder="Token ID"
          value={listTokenId}
          onChange={(event) => setListTokenId(event.target.value)}
        />
        <input
          placeholder="Price in ETH"
          value={listPrice}
          onChange={(event) => setListPrice(event.target.value)}
        />
        <button onClick={listForResale} disabled={!contract || !listTokenId || !listPrice}>List</button>
      </section>

      <section>
        <h2>Buy Resale Ticket</h2>
        <input
          placeholder="Token ID"
          value={buyResaleTokenId}
          onChange={(event) => setBuyResaleTokenId(event.target.value)}
        />
        <button onClick={buyResale} disabled={!contract || !buyResaleTokenId}>Buy Resale</button>
      </section>

      <section>
        <h2>Organizer Check-In</h2>
        <input
          placeholder="Token ID"
          value={redeemTokenId}
          onChange={(event) => setRedeemTokenId(event.target.value)}
        />
        <button onClick={redeemTicket} disabled={!contract || !redeemTokenId}>Redeem</button>
      </section>

      <section>
        <h2>Status</h2>
        <div className="status">{status}</div>
      </section>
    </div>
  );
}
