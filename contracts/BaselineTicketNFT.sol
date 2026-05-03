// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// Naive ERC-721 ticket used as the baseline in our comparison against
// EventTicketNFT. Same primary-sale and redemption surface, but no
// listing, no resale cap, and no transfer hook -- holders can move
// tickets freely.
contract BaselineTicketNFT is ERC721, Ownable2Step, ReentrancyGuard {
    error NotOrganizer();
    error SoldOut();
    error IncorrectPayment(uint256 required, uint256 provided);
    error AlreadyRedeemed();
    error InvalidTicket();

    uint256 public immutable maxSupply;
    uint256 public immutable primaryPrice;
    uint256 public totalMinted;

    mapping(uint256 => bool) private _redeemed;

    event TicketMinted(address indexed to, uint256 indexed tokenId);
    event TicketPurchased(address indexed buyer, uint256 indexed tokenId, uint256 price, bool isPrimary);
    event TicketRedeemed(address indexed organizer, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 primaryPrice_
    ) ERC721(name_, symbol_) {
        maxSupply = maxSupply_;
        primaryPrice = primaryPrice_;
    }

    modifier onlyOrganizer() {
        if (msg.sender != owner()) {
            revert NotOrganizer();
        }
        _;
    }

    function mintTo(address to) external onlyOrganizer {
        if (totalMinted >= maxSupply) {
            revert SoldOut();
        }
        uint256 tokenId = totalMinted + 1;
        totalMinted = tokenId;

        _safeMint(to, tokenId);
        emit TicketMinted(to, tokenId);
    }

    function buyTicket() external payable nonReentrant {
        if (totalMinted >= maxSupply) {
            revert SoldOut();
        }
        if (msg.value != primaryPrice) {
            revert IncorrectPayment(primaryPrice, msg.value);
        }

        uint256 tokenId = totalMinted + 1;
        totalMinted = tokenId;

        _safeMint(msg.sender, tokenId);
        emit TicketPurchased(msg.sender, tokenId, msg.value, true);
    }

    function redeem(uint256 tokenId) external onlyOrganizer {
        if (!_exists(tokenId)) {
            revert InvalidTicket();
        }
        if (_redeemed[tokenId]) {
            revert AlreadyRedeemed();
        }
        _redeemed[tokenId] = true;
        emit TicketRedeemed(msg.sender, tokenId);
    }

    function isRedeemed(uint256 tokenId) external view returns (bool redeemed) {
        return _redeemed[tokenId];
    }
}
