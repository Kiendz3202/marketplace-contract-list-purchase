const { ethers, run, network } = require('hardhat');

const main = async () => {
	//deploy token WANA
	console.log('Deploying token WANA....');
	const TokenContract = await ethers.getContractFactory('WANA');
	const WANA = await TokenContract.deploy();
	await WANA.deployed();
	console.log(WANA.address);

	const MarketplaceContract = await ethers.getContractFactory('Marketplace');
	console.log('Deploying contract....');
	const marketplaceContract = await MarketplaceContract.deploy(WANA.address);
	await marketplaceContract.deployed();
	console.log('Deployed contract to: ' + marketplaceContract.address);

	const NFT = await ethers.getContractFactory('NFT');
	const nft = await NFT.deploy();
	await nft.deployed();
	console.log(nft.address);
};

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
