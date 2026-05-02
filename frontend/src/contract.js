export const CONTRACT_ADDRESS = "REPLACE_WITH_DEPLOYED_ADDRESS";

export const CONTRACT_ABI = [
  "function buyTicket() payable",
  "function mintTo(address to)",
  "function listForResale(uint256 tokenId, uint256 price)",
  "function buyResale(uint256 tokenId) payable",
  "function redeem(uint256 tokenId)",
  "function isRedeemed(uint256 tokenId) view returns (bool)",
  "function getListing(uint256 tokenId) view returns (address seller, uint256 price, bool active)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function primaryPrice() view returns (uint256)",
  "function resalePriceCap() view returns (uint256)",
  "function maxSupply() view returns (uint256)",
  "function totalMinted() view returns (uint256)",
  "function owner() view returns (address)"
];
