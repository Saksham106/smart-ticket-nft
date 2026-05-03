export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

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
  "function owner() view returns (address)",
  "error NotOrganizer()",
  "error SoldOut()",
  "error IncorrectPayment(uint256 required, uint256 provided)",
  "error ResaleCapTooLow(uint256 cap, uint256 primaryPrice)",
  "error ResalePriceTooHigh(uint256 maxPrice, uint256 provided)",
  "error NotTokenOwner()",
  "error NotListed()",
  "error AlreadyRedeemed()",
  "error TransferNotAllowed()",
  "error EthTransferFailed()",
  "error InvalidTicket()"
];
