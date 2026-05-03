// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EventTicketNFT is ERC721, Ownable2Step, ReentrancyGuard {
    error NotOrganizer();
    error SoldOut();
    error IncorrectPayment(uint256 required, uint256 provided);
    error ResaleCapTooLow(uint256 cap, uint256 primaryPrice);
    error ResalePriceTooHigh(uint256 maxPrice, uint256 provided);
    error NotTokenOwner();
    error NotListed();
    error AlreadyRedeemed();
    error TransferNotAllowed();
    error EthTransferFailed();
    error InvalidTicket();

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    uint256 public immutable maxSupply;
    uint256 public immutable primaryPrice;
    uint256 public immutable resalePriceCap;
    uint256 public totalMinted;

    mapping(uint256 => bool) private _redeemed;
    mapping(uint256 => Listing) private _listings;
    bool private _transferAllowed;

    event TicketMinted(address indexed to, uint256 indexed tokenId);
    event TicketPurchased(address indexed buyer, uint256 indexed tokenId, uint256 price, bool isPrimary);
    event TicketListed(address indexed seller, uint256 indexed tokenId, uint256 price);
    event TicketResalePurchased(address indexed buyer, uint256 indexed tokenId, uint256 price);
    event TicketRedeemed(address indexed organizer, uint256 indexed tokenId);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        uint256 primaryPrice_,
        uint256 resalePriceCap_
    ) ERC721(name_, symbol_) {
        if (resalePriceCap_ < primaryPrice_) {
            revert ResaleCapTooLow(resalePriceCap_, primaryPrice_);
        }
        maxSupply = maxSupply_;
        primaryPrice = primaryPrice_;
        resalePriceCap = resalePriceCap_;
    }

    modifier onlyOrganizer() {
        if (msg.sender != owner()) {
            revert NotOrganizer();
        }
        _;
    }

    /// @notice Organizer-only mint for demo purposes.
    /// @param to The recipient of the ticket NFT.
    function mintTo(address to) external onlyOrganizer {
        if (totalMinted >= maxSupply) {
            revert SoldOut();
        }
        uint256 tokenId = totalMinted + 1;
        totalMinted = tokenId;

        _safeMint(to, tokenId);
        emit TicketMinted(to, tokenId);
    }

    /// @notice Buy a primary ticket if supply remains.
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

    /// @notice List an owned ticket for resale under the cap.
    /// @param tokenId The ticket to list.
    /// @param price The resale price in wei.
    function listForResale(uint256 tokenId, uint256 price) external {
        if (ownerOf(tokenId) != msg.sender) {
            revert NotTokenOwner();
        }
        if (_redeemed[tokenId]) {
            revert AlreadyRedeemed();
        }
        if (price > resalePriceCap) {
            revert ResalePriceTooHigh(resalePriceCap, price);
        }

        _listings[tokenId] = Listing({seller: msg.sender, price: price, active: true});
        emit TicketListed(msg.sender, tokenId, price);
    }

    /// @notice Buy a listed resale ticket at the listed price.
    /// @param tokenId The ticket to purchase.
    function buyResale(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = _listings[tokenId];
        if (!listing.active) {
            revert NotListed();
        }
        if (_redeemed[tokenId]) {
            revert AlreadyRedeemed();
        }
        if (msg.value != listing.price) {
            revert IncorrectPayment(listing.price, msg.value);
        }

        _listings[tokenId].active = false;

        _transferAllowed = true;
        _safeTransfer(listing.seller, msg.sender, tokenId, "");
        _transferAllowed = false;

        (bool success, ) = listing.seller.call{value: msg.value}("");
        if (!success) {
            revert EthTransferFailed();
        }

        emit TicketResalePurchased(msg.sender, tokenId, msg.value);
    }

    /// @notice Organizer-only ticket redemption.
    /// @param tokenId The ticket to redeem.
    function redeem(uint256 tokenId) external onlyOrganizer {
        if (!_exists(tokenId)) {
            revert InvalidTicket();
        }
        if (_redeemed[tokenId]) {
            revert AlreadyRedeemed();
        }
        _redeemed[tokenId] = true;
        if (_listings[tokenId].active) {
            _listings[tokenId].active = false;
        }
        emit TicketRedeemed(msg.sender, tokenId);
    }

    /// @notice Check redemption status for a ticket.
    /// @param tokenId The ticket to check.
    /// @return redeemed True if the ticket has been redeemed.
    function isRedeemed(uint256 tokenId) external view returns (bool redeemed) {
        return _redeemed[tokenId];
    }

    /// @notice Get listing info for a ticket.
    /// @param tokenId The ticket to query.
    /// @return seller The listing seller.
    /// @return price The listing price in wei.
    /// @return active True if listed.
    function getListing(uint256 tokenId) external view returns (address seller, uint256 price, bool active) {
        Listing memory listing = _listings[tokenId];
        return (listing.seller, listing.price, listing.active);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        if (from != address(0) && to != address(0) && !_transferAllowed) {
            revert TransferNotAllowed();
        }
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}
