const { assert, expect } = require('chai');
const { constants, Contract } = require('ethers');
const { ethers } = require('hardhat');

describe('NFTMarket', () => {
	let marketplace;
	let WANA;
	let nft;
	let signers;
	const URI = 'https://some-token.uri/';

	before(async () => {
		signers = await ethers.getSigners();
		//deploy wanaka token
		const TokenContract = await ethers.getContractFactory('WANA');
		WANA = await TokenContract.deploy();
		await WANA.deployed();

		// Deploy the Marketplace contract
		const NFTMarket = await ethers.getContractFactory('Marketplace');
		marketplace = await NFTMarket.deploy(WANA.address);
		await marketplace.deployed();

		//deploy nft contract
		const NFT = await ethers.getContractFactory('NFT');
		nft = await NFT.deploy();
		await nft.deployed();

		WANA.connect(signers[0]).transfer(signers[1].address, 1000);
		WANA.connect(signers[0]).transfer(signers[2].address, 1000);
		WANA.connect(signers[1]).approve(marketplace.address, 1000);
		WANA.connect(signers[2]).approve(marketplace.address, 1000);
		WANA.connect(signers[0]).approve(marketplace.address, 10000);
	});

	describe('Minting NFTs', function () {
		it('Should track each minted NFT', async function () {
			// addr1 mints an nft
			await nft.connect(signers[1]).mint(URI);
			expect(await nft.tokenCount()).to.equal(1);
			expect(await nft.balanceOf(signers[1].address)).to.equal(1);
			expect(await nft.tokenURI(1)).to.equal(URI);
			// addr2 mints an nft
			await nft.connect(signers[2]).mint(URI);
			expect(await nft.tokenCount()).to.equal(2);
			expect(await nft.balanceOf(signers[2].address)).to.equal(1);
			expect(await nft.tokenURI(2)).to.equal(URI);
		});
	});

	describe('listNFT', () => {
		let price = 100;
		beforeEach(async function () {
			// addr1 mints an nft
			await nft.connect(signers[1]).mint(URI);
			// addr1 approves marketplace to spend nft
			await nft
				.connect(signers[1])
				.setApprovalForAll(marketplace.address, true);
		});

		it('Should track newly created item, transfer NFT from seller to marketplace and emit Offered event', async function () {
			// addr1 offers their nft at a price of 1 ether
			await expect(
				marketplace.connect(signers[1]).listNFT(nft.address, 1, price)
			)
				.to.emit(marketplace, 'Offered')
				.withArgs(1, nft.address, 1, price, signers[1].address);

			// Owner of NFT should now be the marketplace
			expect(await nft.ownerOf(1)).to.equal(marketplace.address);
			// // Item count should now equal 1
			expect(await marketplace.itemCount()).to.equal(1);
			// // Get item from items mapping then check fields to ensure they are correct
			const item = await marketplace._listings(1);

			expect(item.itemId).to.equal(1);
			expect(item.nft).to.equal(nft.address);
			expect(item.tokenId).to.equal(1);
			expect(item.price).to.equal(price);
			expect(item.sold).to.equal(false);
		});

		it('should fail if price is set to zero', async () => {
			await expect(
				marketplace.connect(signers[1]).listNFT(nft.address, 1, 0)
			).to.be.revertedWith('NFTMarket: price must be greater than 0');
		});
	});

	describe('Purchasing marketplace items', function () {
		let price = 100;
		let fee = 10;
		beforeEach(async function () {
			// addr1 mints an nft
			await nft.connect(signers[1]).mint(URI);
			// addr1 approves marketplace to spend tokens
			await nft
				.connect(signers[1])
				.setApprovalForAll(marketplace.address, true);
			// addr1 makes their nft a marketplace item.
			await marketplace
				.connect(signers[1])
				.listNFT(nft.address, 5, price);
		});
		it('Should update item as sold, pay seller, transfer NFT to buyer, charge fees and emit a Bought event', async function () {
			// console.log(await WANA.balanceOf(signers[0].address));
			// console.log(await WANA.balanceOf(signers[1].address));
			// console.log(await WANA.balanceOf(signers[2].address));
			const sellerInitalBal = await WANA.balanceOf(signers[1].address);
			const buyerInitalBal = await WANA.balanceOf(signers[2].address);
			const marketplaceInitialBal = await WANA.balanceOf(
				marketplace.address
			);
			// addr 2 purchases item.
			await expect(marketplace.connect(signers[2]).buyNFT(5))
				.to.emit(marketplace, 'Bought')
				.withArgs(
					2,
					nft.address,
					5,
					price,
					signers[1].address,
					signers[2].address
				);
			const sellerFinalBal = await WANA.balanceOf(signers[1].address);
			const buyerFinalBal = await WANA.balanceOf(signers[2].address);
			const marketplaceFinalInitialBal = await WANA.balanceOf(
				marketplace.address
			);
			//check balance of buyer, seller, marketplace after buying
			assert(buyerFinalBal, buyerInitalBal - 100);
			assert(sellerFinalBal, sellerInitalBal + 90);
			assert(marketplaceFinalInitialBal, marketplaceInitialBal + 10);
			// // Item should be marked as sold
			expect((await marketplace._listings(5)).sold).to.equal(true);

			// // The buyer should now own the nft
			expect(await nft.ownerOf(5)).to.equal(signers[2].address);
		});
	});

	describe('withdrawFunds', async () => {
		it("should transfer all funds from the contract balance to the owner's", async () => {
			const contractInitBalance = await WANA.balanceOf(
				marketplace.address
			);
			const initialOwnerBalance = await WANA.balanceOf(
				signers[0].address
			);

			await marketplace.connect(signers[0]).withdrawFunds();

			const contractNewBalance = await WANA.balanceOf(
				marketplace.address
			);
			const newOwnerBalance = await WANA.balanceOf(signers[0].address);
			// //check balance of marketplace and signer[0]
			expect(contractNewBalance).to.equal(0);
			expect(newOwnerBalance, initialOwnerBalance + contractInitBalance);
		});

		it('should revert if contract balance is zero', async () => {
			const transaction = marketplace.withdrawFunds();
			await expect(transaction).to.be.revertedWith(
				'NFTMarket: balance is zero'
			);
		});
	});
});
