const anchor = require("@project-serum/anchor");
const assert = require("assert");

describe("start auction", () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace.Auction;
  const feePayerPubkey = provider.wallet.publicKey;

  it("should fail when owner of item isn't pda", async () => {
    let auction = new anchor.web3.Account();
    let seller = new anchor.web3.Account();
    let itemPubkey = await createMint(provider, feePayerPubkey);
    let currencyPubkey = await createMint(provider, feePayerPubkey);
    let itemHolderPubkey = await createTokenAccount(provider, itemPubkey, new anchor.web3.Account().publicKey);
    let currencyHolderPubkey = await createTokenAccount(provider, currencyPubkey, new anchor.web3.Account().publicKey);
    try {
      await program.rpc.createAuction(new anchor.BN(1000), {
        accounts: {
          auction: auction.publicKey,
          seller: seller.publicKey,
          itemHolder: itemHolderPubkey,
          currencyHolder: currencyHolderPubkey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [auction],
        instructions: [await program.account.auction.createInstruction(auction)],
      });
      assert.ok(false);
    } catch (e) {}
  });

  it("should fail when owner of currency isn't pda", async () => {
    let auction = new anchor.web3.Account();
    let seller = new anchor.web3.Account();
    let [pda] = await anchor.web3.PublicKey.findProgramAddress([seller.publicKey.toBuffer()], program.programId);
    let itemPubkey = await createMint(provider, feePayerPubkey);
    let currencyPubkey = await createMint(provider, feePayerPubkey);
    let itemHolderPubkey = await createTokenAccount(provider, itemPubkey, pda);
    let currencyHolderPubkey = await createTokenAccount(provider, currencyPubkey, new anchor.web3.Account().publicKey);
    try {
      await program.rpc.createAuction(new anchor.BN(1000), {
        accounts: {
          auction: auction.publicKey,
          seller: seller.publicKey,
          itemHolder: itemHolderPubkey,
          currencyHolder: currencyHolderPubkey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [auction],
        instructions: [await program.account.auction.createInstruction(auction)],
      });
      assert.ok(false);
    } catch (e) {}
  });

  it("should fail when init same auction account twice", async () => {
    let auction = new anchor.web3.Account();
    let seller = new anchor.web3.Account();
    let [pda] = await anchor.web3.PublicKey.findProgramAddress([seller.publicKey.toBuffer()], program.programId);
    let itmePubkey = await createMint(provider, feePayerPubkey);
    let itemHolderPubkey = await createTokenAccount(provider, itmePubkey, pda);
    let currencyPubkey = await createMint(provider, feePayerPubkey);
    let currencyHolderPubkey = await createTokenAccount(provider, currencyPubkey, pda);
    let startPrice = 1000;

    await program.rpc.createAuction(new anchor.BN(startPrice), {
      accounts: {
        auction: auction.publicKey,
        seller: seller.publicKey,
        itemHolder: itemHolderPubkey,
        currencyHolder: currencyHolderPubkey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [auction],
      instructions: [await program.account.auction.createInstruction(auction)],
    });

    try {
      await program.rpc.createAuction(new anchor.BN(1000), {
        accounts: {
          auction: auction.publicKey,
          seller: seller.publicKey,
          itemHolder: itemHolderPubkey,
          currencyHolder: currencyHolderPubkey,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
      });
      assert.ok(false);
    } catch (e) {}
  });

  it("init auction", async () => {
    let auction = new anchor.web3.Account();
    let seller = new anchor.web3.Account();
    let [pda] = await anchor.web3.PublicKey.findProgramAddress([seller.publicKey.toBuffer()], program.programId);
    let itmePubkey = await createMint(provider, feePayerPubkey);
    let itemHolderPubkey = await createTokenAccount(provider, itmePubkey, pda);
    let currencyPubkey = await createMint(provider, feePayerPubkey);
    let currencyHolderPubkey = await createTokenAccount(provider, currencyPubkey, pda);

    await program.rpc.createAuction(new anchor.BN(1000), {
      accounts: {
        auction: auction.publicKey,
        seller: seller.publicKey,
        itemHolder: itemHolderPubkey,
        currencyHolder: currencyHolderPubkey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [auction],
      instructions: [await program.account.auction.createInstruction(auction)],
    });

    let emptyPubkey = new anchor.web3.PublicKey();

    const accountAccount = await program.account.auction(auction.publicKey);
    assert.ok(accountAccount.ongoing);
    assert.ok(accountAccount.seller.equals(seller.publicKey));
    assert.ok(accountAccount.itemHolder.equals(itemHolderPubkey));
    assert.ok(accountAccount.currencyHolder.equals(currencyHolderPubkey));
    assert.ok(accountAccount.bidder.equals(seller.publicKey));
    assert.ok(accountAccount.refundReceiver.equals(emptyPubkey));
    assert.ok(accountAccount.price == 1000);
  });

  it("close a auction which no one bid", async () => {
    let auction = new anchor.web3.Account();
    let seller = new anchor.web3.Account();
    let [pda] = await anchor.web3.PublicKey.findProgramAddress([seller.publicKey.toBuffer()], program.programId);
    let itmePubkey = await createMint(provider, feePayerPubkey);
    let itemHolderPubkey = await createTokenAccountWithBalance(provider, itmePubkey, pda, 1);
    let itemReceiver = await createTokenAccountWithBalance(provider, itmePubkey, seller.publicKey, 0);
    let currencyPubkey = await createMint(provider, feePayerPubkey);
    let currencyHolderPubkey = await createTokenAccount(provider, currencyPubkey, pda);
    let currencyReceiver = await createTokenAccountWithBalance(provider, currencyPubkey, seller.publicKey, 0);

    await program.rpc.createAuction(new anchor.BN(1000), {
      accounts: {
        auction: auction.publicKey,
        seller: seller.publicKey,
        itemHolder: itemHolderPubkey,
        currencyHolder: currencyHolderPubkey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [auction],
      instructions: [await program.account.auction.createInstruction(auction)],
    });

    await program.rpc.closeAuction({
      accounts: {
        auction: auction.publicKey,
        seller: seller.publicKey,
        itemHolder: itemHolderPubkey,
        itemHolderAuth: pda,
        itemReceiver: itemReceiver,
        currencyHolder: currencyHolderPubkey,
        currencyHolderAuth: pda,
        currencyReceiver: currencyReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [seller],
    });

    let accountAccount = await program.account.auction(auction.publicKey);
    assert.ok(!accountAccount.ongoing);

    let tokenAccount = await getTokenAccount(provider, itemHolderPubkey);
    assert(tokenAccount.amount == 0);

    tokenAccount = await getTokenAccount(provider, itemReceiver);
    assert(tokenAccount.amount == 1);

    tokenAccount = await getTokenAccount(provider, currencyHolderPubkey);
    assert(tokenAccount.amount == 0);

    tokenAccount = await getTokenAccount(provider, currencyReceiver);
    assert(tokenAccount.amount == 0);
  });
});

describe("bid", () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace.Auction;

  it("should fail when bid a lower number", async () => {
    const { auction, seller, pda, itemPubkey, currencyPubkey } = await CreateAuction(provider, program);

    let auctionAccount = await program.account.auction(auction.publicKey);

    let bidder = new anchor.web3.Account();
    let bidderCurrencyHolder = await createTokenAccountWithBalance(provider, currencyPubkey, bidder.publicKey, 2000);

    try {
      await program.rpc.bid(new anchor.BN(1000), {
        accounts: {
          auction: auction.publicKey,
          bidder: bidder.publicKey,
          from: bidderCurrencyHolder,
          fromAuth: bidder.publicKey,
          currencyHolder: auctionAccount.currencyHolder,
          currencyHolderAuth: pda,
          oriRefundReceiver: auctionAccount.refundReceiver,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [bidder],
      });
      assert.ok(false);
    } catch (err) {
      const errMsg = "your bid price is too low";
      assert.strictEqual(err.toString(), errMsg);
      assert.strictEqual(err.msg, errMsg);
      assert.strictEqual(err.code, 100);
    }
  });

  it("first bid", async () => {
    const { auction, seller, pda, itemPubkey, currencyPubkey } = await CreateAuction(provider, program);

    let auctionAccount = await program.account.auction(auction.publicKey);
    let bidder = new anchor.web3.Account();
    let bidderCurrencyHolder = await createTokenAccountWithBalance(provider, currencyPubkey, bidder.publicKey, 2000);

    await program.rpc.bid(new anchor.BN(2000), {
      accounts: {
        auction: auction.publicKey,
        bidder: bidder.publicKey,
        from: bidderCurrencyHolder,
        fromAuth: bidder.publicKey,
        currencyHolder: auctionAccount.currencyHolder,
        currencyHolderAuth: pda,
        oriRefundReceiver: auctionAccount.refundReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [bidder],
    });

    auctionAccount = await program.account.auction(auction.publicKey);
    assert(auctionAccount.bidder.equals(bidder.publicKey));
    assert(auctionAccount.refundReceiver.equals(bidderCurrencyHolder));
    assert(auctionAccount.price == 2000);
    assert((await getTokenAccount(provider, bidderCurrencyHolder)).amount == 0);
    assert((await getTokenAccount(provider, auctionAccount.currencyHolder)).amount == 2000);
  });

  it("second bid", async () => {
    const { auction, seller, pda, itemPubkey, currencyPubkey } = await CreateAuction(provider, program);

    let auctionAccount = await program.account.auction(auction.publicKey);

    let bidder = new anchor.web3.Account();
    let bidderCurrencyHolder = await createTokenAccountWithBalance(provider, currencyPubkey, bidder.publicKey, 2000);

    await program.rpc.bid(new anchor.BN(2000), {
      accounts: {
        auction: auction.publicKey,
        bidder: bidder.publicKey,
        from: bidderCurrencyHolder,
        fromAuth: bidder.publicKey,
        currencyHolder: auctionAccount.currencyHolder,
        currencyHolderAuth: pda,
        oriRefundReceiver: auctionAccount.refundReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [bidder],
    });

    let bidder2 = new anchor.web3.Account();
    let bidder2CurrencyHolder = await createTokenAccountWithBalance(provider, currencyPubkey, bidder2.publicKey, 3000);

    auctionAccount = await program.account.auction(auction.publicKey);
    await program.rpc.bid(new anchor.BN(3000), {
      accounts: {
        auction: auction.publicKey,
        bidder: bidder2.publicKey,
        from: bidder2CurrencyHolder,
        fromAuth: bidder2.publicKey,
        currencyHolder: auctionAccount.currencyHolder,
        currencyHolderAuth: pda,
        oriRefundReceiver: auctionAccount.refundReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [bidder2],
    });

    accountAccount = await program.account.auction(auction.publicKey);
    assert(accountAccount.bidder.equals(bidder2.publicKey));
    assert(accountAccount.refundReceiver.equals(bidder2CurrencyHolder));
    assert(accountAccount.price == 3000);
    assert((await getTokenAccount(provider, bidderCurrencyHolder)).amount == 2000);
    assert((await getTokenAccount(provider, bidder2CurrencyHolder)).amount == 0);
    assert((await getTokenAccount(provider, accountAccount.currencyHolder)).amount == 3000);
  });
});

describe("clost auction", () => {
  const provider = anchor.Provider.local();
  anchor.setProvider(provider);
  const program = anchor.workspace.Auction;

  it("close a auction which no one bid", async () => {
    const { auction, seller, pda, itemPubkey, currencyPubkey } = await CreateAuction(provider, program);

    let itemReceiver = await createTokenAccountWithBalance(provider, itemPubkey, seller.publicKey, 0);
    let currencyReceiver = await createTokenAccountWithBalance(provider, currencyPubkey, seller.publicKey, 0);

    let auctionAccount = await program.account.auction(auction.publicKey);
    let itemHolder = auctionAccount.itemHolder;
    let currencyHolder = auctionAccount.currencyHolder;
    await program.rpc.closeAuction({
      accounts: {
        auction: auction.publicKey,
        seller: seller.publicKey,
        itemHolder: itemHolder,
        itemHolderAuth: pda,
        itemReceiver: itemReceiver,
        currencyHolder: currencyHolder,
        currencyHolderAuth: pda,
        currencyReceiver: currencyReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [seller],
    });

    auctionAccount = await program.account.auction(auction.publicKey);
    itemHolder = auctionAccount.itemHolder;
    currencyHolder = auctionAccount.currencyHolder;
    assert.ok(!auctionAccount.ongoing);
    assert.ok((await getTokenAccount(provider, itemHolder)).amount == 0);
    assert.ok((await getTokenAccount(provider, itemReceiver)).amount == 1);
    assert.ok((await getTokenAccount(provider, currencyHolder)).amount == 0);
    assert.ok((await getTokenAccount(provider, currencyReceiver)).amount == 0);
  });

  it("close a auction", async () => {
    const { auction, seller, pda, itemPubkey, currencyPubkey } = await CreateAuction(provider, program);

    const { bidder, bidderCurrencyHolder } = await Bid(provider, program, auction, currencyPubkey, 2000);

    let itemReceiver = await createTokenAccountWithBalance(provider, itemPubkey, bidder.publicKey, 0);
    let currencyReceiver = await createTokenAccountWithBalance(provider, currencyPubkey, seller.publicKey, 0);

    let auctionAccount = await program.account.auction(auction.publicKey);
    await program.rpc.closeAuction({
      accounts: {
        auction: auction.publicKey,
        seller: seller.publicKey,
        itemHolder: auctionAccount.itemHolder,
        itemHolderAuth: pda,
        itemReceiver: itemReceiver,
        currencyHolder: auctionAccount.currencyHolder,
        currencyHolderAuth: pda,
        currencyReceiver: currencyReceiver,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [seller],
    });

    auctionAccount = await program.account.auction(auction.publicKey);
    let itemHolder = auctionAccount.itemHolder;
    let currencyHolder = auctionAccount.currencyHolder;
    assert.ok(!auctionAccount.ongoing);
    assert.ok((await getTokenAccount(provider, itemHolder)).amount == 0);
    assert.ok((await getTokenAccount(provider, itemReceiver)).amount == 1);
    assert.ok((await getTokenAccount(provider, currencyHolder)).amount == 0);
    assert.ok((await getTokenAccount(provider, currencyReceiver)).amount == 2000);
  });
});

async function CreateAuction(provider, program) {
  const feePayerPubkey = provider.wallet.publicKey;
  let auction = new anchor.web3.Account();
  let seller = new anchor.web3.Account();
  let [pda] = await anchor.web3.PublicKey.findProgramAddress([seller.publicKey.toBuffer()], program.programId);
  let itmePubkey = await createMint(provider, feePayerPubkey);
  let itemHolderPubkey = await createTokenAccountWithBalance(provider, itmePubkey, pda, 1);
  let currencyPubkey = await createMint(provider, feePayerPubkey);
  let currencyHolderPubkey = await createTokenAccount(provider, currencyPubkey, pda);

  await program.rpc.createAuction(new anchor.BN(1000), {
    accounts: {
      auction: auction.publicKey,
      seller: seller.publicKey,
      itemHolder: itemHolderPubkey,
      currencyHolder: currencyHolderPubkey,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    },
    signers: [auction],
    instructions: [await program.account.auction.createInstruction(auction)],
  });

  return {
    auction: auction,
    seller: seller,
    pda: pda,
    itemPubkey: itmePubkey,
    currencyPubkey: currencyPubkey,
  };
}

async function Bid(provider, program, auction, currencyPubkey, bidNum) {
  let bidder = new anchor.web3.Account();
  let bidderCurrencyHolder = await createTokenAccountWithBalance(provider, currencyPubkey, bidder.publicKey, bidNum);
  let auctionAccount = await program.account.auction(auction.publicKey);
  let [pda] = await anchor.web3.PublicKey.findProgramAddress([auctionAccount.seller.toBuffer()], program.programId);

  await program.rpc.bid(new anchor.BN(bidNum), {
    accounts: {
      auction: auction.publicKey,
      bidder: bidder.publicKey,
      from: bidderCurrencyHolder,
      fromAuth: bidder.publicKey,
      currencyHolder: auctionAccount.currencyHolder,
      currencyHolderAuth: pda,
      oriRefundReceiver: auctionAccount.refundReceiver,
      tokenProgram: TOKEN_PROGRAM_ID,
    },
    signers: [bidder],
  });

  return {
    bidder: bidder,
    bidderCurrencyHolder: bidderCurrencyHolder,
  };
}
// SPL token client boilerplate for test initialization. Everything below here is
// mostly irrelevant to the point of the example.

const serumCmn = require("@project-serum/common");
const TokenInstructions = require("@project-serum/serum").TokenInstructions;

// TODO: remove this constant once @project-serum/serum uses the same version
//       of @solana/web3.js as anchor (or switch packages).
const TOKEN_PROGRAM_ID = new anchor.web3.PublicKey(TokenInstructions.TOKEN_PROGRAM_ID.toString());

async function getTokenAccount(provider, addr) {
  return await serumCmn.getTokenAccount(provider, addr);
}

async function createMint(provider, authority) {
  if (authority === undefined) {
    authority = provider.wallet.publicKey;
  }
  const mint = new anchor.web3.Account();
  const instructions = await createMintInstructions(provider, authority, mint.publicKey);

  const tx = new anchor.web3.Transaction();
  tx.add(...instructions);

  await provider.send(tx, [mint]);

  return mint.publicKey;
}

async function createMintInstructions(provider, authority, mint) {
  let instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeMint({
      mint,
      decimals: 0,
      mintAuthority: authority,
    }),
  ];
  return instructions;
}

async function createTokenAccountWithBalance(provider, mint, owner, initBalance) {
  const vault = new anchor.web3.Account();
  const tx = new anchor.web3.Transaction();
  tx.add(
    ...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner)),
    TokenInstructions.mintTo({
      mint: mint,
      destination: vault.publicKey,
      amount: initBalance,
      mintAuthority: provider.wallet.publicKey,
    })
  );
  await provider.send(tx, [vault]);
  return vault.publicKey;
}

async function createTokenAccount(provider, mint, owner) {
  const vault = new anchor.web3.Account();
  const tx = new anchor.web3.Transaction();
  tx.add(...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner)));
  await provider.send(tx, [vault]);
  return vault.publicKey;
}

async function createTokenAccountInstrs(provider, newAccountPubkey, mint, owner, lamports) {
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
  }
  return [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey,
      space: 165,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    TokenInstructions.initializeAccount({
      account: newAccountPubkey,
      mint,
      owner,
    }),
  ];
}

async function mintTo(provider, mintPubkey, tokenAccountPubkey, amount) {
  const tx = new anchor.web3.Transaction();
  tx.add(
    TokenInstructions.mintTo({
      mint: mintPubkey,
      destination: tokenAccountPubkey,
      amount: amount,
      mintAuthority: provider.wallet.publicKey,
    })
  );
  await provider.send(tx);
}
