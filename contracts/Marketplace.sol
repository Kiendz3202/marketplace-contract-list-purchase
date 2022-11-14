// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

struct NFTListing {
    uint itemId;
    IERC721 nft;
    uint tokenId;
    uint price;
    address seller;
    bool sold;
}

contract Marketplace is Ownable, ReentrancyGuard {
    IERC20 public wanakaToken;
    uint public itemCount;
    // using Counters for Counters.Counter;
    using SafeMath for uint256;
    // Counters.Counter private _tokenIDs;
    mapping(uint256 => NFTListing) public _listings;

    // if tokenURI is not an empty string => an NFT was created
    // if price is not 0 => an NFT was listed
    // if price is 0 && tokenURI is an empty string => NFT was transferred (either bought, or the listing was canceled)
    event Offered(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    );
    event Bought(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller,
        address indexed buyer
    );

    constructor(address _tokenAddress) {
        wanakaToken = IERC20(_tokenAddress);
    }

    // function createNFT(string calldata tokenURI) public {
    //     _tokenIDs.increment();
    //     uint256 currentID = _tokenIDs.current();
    //     _safeMint(msg.sender, currentID);
    //     _setTokenURI(currentID, tokenURI);
    //     emit NFTTransfer(currentID, address(0), msg.sender, tokenURI, 0);
    // }

    //seller list nft on marketplace
    function listNFT(
        IERC721 _nft,
        uint256 _tokenID,
        uint256 _price
    ) external nonReentrant {
        require(_price > 0, "NFTMarket: price must be greater than 0");
        require(
            _nft.ownerOf(_tokenID) == msg.sender,
            "You are not the owner of NFT"
        );
        itemCount++;
        _nft.transferFrom(msg.sender, address(this), _tokenID);
        _listings[_tokenID] = NFTListing(
            itemCount,
            _nft,
            _tokenID,
            _price,
            msg.sender,
            false
        );
        emit Offered(itemCount, address(_nft), _tokenID, _price, msg.sender);
    }

    function buyNFT(uint256 _tokenID) external nonReentrant {
        NFTListing memory listing = _listings[_tokenID];

        require(listing.price > 0, "NFTMarket: nft not listed for sale");
        require(!listing.sold, "item already sold");
        require(_tokenID > 0, "item doesn't exist");
        // require(_price == listing.price, "NFTMarket: incorrect price");

        // ERC721(address(this)).transferFrom(address(this), msg.sender, tokenID, _price, false);

        // wanakaToken.approve(address(this), 1000000 * 10**18);

        //token from buyer send 90% to seller and 10% to marketplace contract
        for (uint i = 0; i <= 1; i++) {
            if (i == 0) {
                wanakaToken.transferFrom(
                    msg.sender,
                    listing.seller,
                    listing.price.mul(90).div(100)
                );
            } else {
                wanakaToken.transferFrom(
                    msg.sender,
                    address(this),
                    listing.price.mul(10).div(100)
                );
            }
        }

        _listings[_tokenID].sold = true;
        listing.nft.transferFrom(address(this), msg.sender, listing.tokenId);
        emit Bought(
            itemCount,
            address(listing.nft),
            _tokenID,
            listing.price,
            listing.seller,
            msg.sender
        );
    }

    //seller cancel nft that is listed in marketplace
    // function cancelListing(uint256 tokenID) public {
    //     NFTListing memory listing = _listings[tokenID];
    //     require(listing.price > 0, "NFTMarket: nft not listed for sale");
    //     require(
    //         listing.seller == msg.sender,
    //         "NFTMarket: you're not the seller"
    //     );
    //     ERC721(address(this)).transferFrom(address(this), msg.sender, tokenID);
    //     clearListing(tokenID);
    //     emit NFTTransfer(tokenID, address(this), msg.sender, "", 0);
    // }

    //withdraw all token from marketplace contract to marketplace's signer
    function withdrawFunds() public {
        uint256 balance = wanakaToken.balanceOf(address(this));
        require(balance > 0, "NFTMarket: balance is zero");
        wanakaToken.transfer(msg.sender, balance);
        // dùng cái này sẽ bị báo lỗi reverted with reason string 'ERC20: insufficient allowance' khi test gọi đến hàm withdrawFunds
        // wanakaToken.transferFrom(address(this),msg.sender, balance);
    }
}
