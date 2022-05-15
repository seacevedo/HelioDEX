import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { HelioDex } from "../target/types/helio_dex";
import { createAssociatedTokenAccount, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, createMint, createMintToCheckedInstruction, getAccount, getAssociatedTokenAddress, getMinimumBalanceForRentExemptMint, getMint, mintToChecked, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js";
import * as assert from "assert";

describe("helio_dex", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.HelioDex as Program<HelioDex>;
  
  let helioPair: anchor.web3.Keypair;
  let exchangeAuthPda: anchor.web3.PublicKey;
  let lpRewardNum: anchor.BN;
  let lpRewardDenom: anchor.BN;
  let tipNum: anchor.BN;
  let tipDenom: anchor.BN;
  let liqPool: anchor.web3.Keypair;
  let reserveA: anchor.web3.PublicKey;
  let reserveB: anchor.web3.PublicKey;
  let reserveAMint: anchor.web3.Keypair;
  let reserveBMint: anchor.web3.Keypair;
  let feeReserve: anchor.web3.PublicKey;
  let poolMint: anchor.web3.Keypair;
  let liqProvider: anchor.web3.Keypair;
  let providerResA: anchor.web3.PublicKey;
  let providerResB: anchor.web3.PublicKey;
  let providerResPool: anchor.web3.PublicKey;
  let trader: anchor.web3.Keypair;

  const createMint = async(mintKeypair: anchor.web3.Keypair, mintAuth: anchor.web3.PublicKey) => {

    let mintTx = new Transaction().add(
      // create mint account
      SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptMint(program.provider.connection),
        programId: TOKEN_PROGRAM_ID,
      }),
      // init mint account
      createInitializeMintInstruction(
        mintKeypair.publicKey, 
        9, 
        mintAuth, 
        mintAuth, 
      )
    );

    console.log(`txhash: ${await program.provider.send(mintTx, [mintKeypair])}`);
  }

  const createATA = async(mintPubkey: anchor.web3.PublicKey, owner: anchor.web3.Keypair) => {

    console.log("Owner: ", owner.publicKey.toBase58());

    let ata = await getAssociatedTokenAddress(
        mintPubkey, // mint
        owner.publicKey, // owner
    );

    let create_ata_tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        owner.publicKey, // payer
        ata, // ata
        owner.publicKey, // owner
        mintPubkey // mint
      )
    );

    console.log(`txhash: ${await program.provider.connection.sendTransaction(create_ata_tx, [owner])}`);

    return ata;
 }

 const mintTokens = async(mintPubkey: anchor.web3.PublicKey, tokenAccountPubkey: anchor.web3.PublicKey, amount: number) => {
   let tx = new Transaction().add(
      createMintToCheckedInstruction(
        mintPubkey, // mint
        tokenAccountPubkey, // receiver (sholud be a token account)
        program.provider.wallet.publicKey, // mint authority
        1e9, 
        9 
      )
    );
    console.log(`txhash: ${await program.provider.send(tx)}`);
 }



  it("Init Market", async () => {

    [exchangeAuthPda] = await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode("exchange_authority")), program.provider.wallet.publicKey.toBuffer()],
          program.programId
    );

    helioPair = anchor.web3.Keypair.generate();

    lpRewardNum = new anchor.BN(997);
    lpRewardDenom = new anchor.BN(1000);

    let tx = await program.methods.initializeMarket(lpRewardNum, lpRewardDenom)
    .accounts({
          owner: program.provider.wallet.publicKey,
          helio: helioPair.publicKey,
          exchangeAuthority: exchangeAuthPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId
    })
    .signers([helioPair]).rpc({skipPreflight: true, commitment: 'confirmed'});

    console.log("Your transaction signature", tx);



  });

  it("Init Pool", async () => {

    liqPool = anchor.web3.Keypair.generate();

    reserveAMint = anchor.web3.Keypair.generate();
    reserveBMint = anchor.web3.Keypair.generate();
    poolMint = anchor.web3.Keypair.generate();

    createMint(reserveAMint, program.provider.wallet.publicKey);
    createMint(reserveBMint, program.provider.wallet.publicKey);
    createMint(poolMint, exchangeAuthPda);

    [reserveA] = await PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_a")), liqPool.publicKey.toBuffer()],
          program.programId
      );

    [reserveB] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_b")), liqPool.publicKey.toBuffer()],
        program.programId
    );

    [feeReserve] = await PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("fee_reserve")), liqPool.publicKey.toBuffer()],
        program.programId
    );

    console.log(`ATA A: ${reserveA.toBase58()}`);
    console.log(`ATA B: ${reserveB.toBase58()}`);
    console.log(`ATA Fees: ${feeReserve.toBase58()}`);

    liqProvider = anchor.web3.Keypair.generate();

    const airDropSign = await program.provider.connection.requestAirdrop(
          liqProvider.publicKey,
          anchor.web3.LAMPORTS_PER_SOL*1000
    );

    await program.provider.connection.confirmTransaction(airDropSign);

    tipNum = new anchor.BN(20);
    tipDenom = new anchor.BN(100);

    const tx = await program.methods.initializePool(tipNum, tipDenom)
    .accounts({
          payer: liqProvider.publicKey,
          poolState: liqPool.publicKey,
          exchangeAuthority: exchangeAuthPda,
          reserveA: reserveA,
          reserveB: reserveB,
          feeReserve: feeReserve,
          mintA: reserveAMint.publicKey,
          mintB: reserveBMint.publicKey,
          poolMint: poolMint.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY
    })
    .signers([liqProvider, liqPool]).rpc({skipPreflight: true, commitment: 'confirmed'})
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });

    console.log("Your transaction signature", tx);


  });

  it("Provide Liquidity (Zero Liquidity)", async () => {

    providerResA = await createAssociatedTokenAccount(
      program.provider.connection, // connection
      liqProvider, // fee payer
      reserveAMint.publicKey, // mint
      liqProvider.publicKey // owner,
    );
    console.log(`ATA A: ${providerResA.toBase58()}`);

    providerResB = await createAssociatedTokenAccount(
      program.provider.connection, // connection
      liqProvider, // fee payer
      reserveBMint.publicKey, // mint
      liqProvider.publicKey // owner,
    );
    console.log(`ATA B: ${providerResB.toBase58()}`);

    providerResPool = await createAssociatedTokenAccount(
      program.provider.connection, // connection
      liqProvider, // fee payer
      poolMint.publicKey, // mint
      liqProvider.publicKey // owner,
    );
    console.log(`ATA Pool: ${providerResPool.toBase58()}`);


    let tx = new Transaction().add(
      createMintToCheckedInstruction(
        reserveAMint.publicKey, // mint
        providerResA, // receiver (sholud be a token account)
        program.provider.wallet.publicKey, // mint authority
        10e9, 
        9 
      )
    );
    console.log(`txhash: ${await program.provider.send(tx)}`);

    tx = new Transaction().add(
      createMintToCheckedInstruction(
        reserveBMint.publicKey, // mint
        providerResB, // receiver (sholud be a token account)
        program.provider.wallet.publicKey, // mint authority
        10e9, 
        9 
      )
    );
    console.log(`txhash: ${await program.provider.send(tx)}`);


    console.log(await program.provider.connection.getTokenAccountBalance(providerResA));
    console.log(await program.provider.connection.getTokenAccountBalance(providerResB));

    let amountA = 4e9;
    let amountB = 4e9;

    let tx_hash = await program.methods.provideLiquidity(new anchor.BN(amountA), new anchor.BN(amountB))
    .accounts({
          provider: liqProvider.publicKey,
          exchangeAuthority: exchangeAuthPda,
          helio: helioPair.publicKey,
          reserveA: reserveA,
          reserveB: reserveB,
          poolMint: poolMint.publicKey,
          providerReserveA: providerResA,
          providerReserveB: providerResB,
          providerPoolReserve: providerResPool,
          poolState: liqPool.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([liqProvider]).rpc({skipPreflight: true, commitment: 'confirmed'})
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });

    console.log("Your transaction signature", tx_hash);

    let liqShare = await program.provider.connection.getTokenAccountBalance(providerResPool);
    let resAAmt = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmt = await program.provider.connection.getTokenAccountBalance(reserveB);
    const poolAccount = await program.account.poolState.fetch(liqPool.publicKey);
    let poolMintAcct = await getMint(program.provider.connection, poolMint.publicKey);

    assert.equal(parseInt(liqShare.value.amount), Math.sqrt(amountA*amountB));
    assert.equal(parseInt(resAAmt.value.amount), amountA);
    assert.equal(parseInt(resBAmt.value.amount), amountB);
    assert.equal(poolMintAcct.supply, Math.sqrt(amountA*amountB));
  });

  it("Provide Liquidity (Liquidity > 0)", async () => {

    let amountA = 2e9;
    let amountB = 2e9;

    let resAAmt = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmt = await program.provider.connection.getTokenAccountBalance(reserveB);
    let provResAAmt = await program.provider.connection.getTokenAccountBalance(providerResA);
    let provResBAmt = await program.provider.connection.getTokenAccountBalance(providerResB);
    let liqShare = await program.provider.connection.getTokenAccountBalance(providerResPool);
    let poolMintAcct = await getMint(program.provider.connection, poolMint.publicKey);
  

    let tx_hash = await program.methods.provideLiquidity(new anchor.BN(amountA), new anchor.BN(amountB))
    .accounts({
          provider: liqProvider.publicKey,
          exchangeAuthority: exchangeAuthPda,
          helio: helioPair.publicKey,
          reserveA: reserveA,
          reserveB: reserveB,
          poolMint: poolMint.publicKey,
          providerReserveA: providerResA,
          providerReserveB: providerResB,
          providerPoolReserve: providerResPool,
          poolState: liqPool.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([liqProvider]).rpc({skipPreflight: true, commitment: 'confirmed'})
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });

    console.log("Your transaction signature", tx_hash);


    let liqShareNew = await program.provider.connection.getTokenAccountBalance(providerResPool);
    let resAAmtNew = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmtNew = await program.provider.connection.getTokenAccountBalance(reserveB);
    let provResAAmtNew = await program.provider.connection.getTokenAccountBalance(providerResA);
    let provResBAmtNew = await program.provider.connection.getTokenAccountBalance(providerResB);
    let numNewMintedLiq = (amountA*Number(poolMintAcct.supply))/parseInt(resAAmt.value.amount);


    assert.equal(parseInt(liqShareNew.value.amount), parseInt(liqShare.value.amount)+numNewMintedLiq);
    assert.equal(parseInt(resAAmtNew.value.amount), parseInt(resAAmt.value.amount)+amountA);
    assert.equal(parseInt(resBAmtNew.value.amount), parseInt(resBAmt.value.amount)+amountB);
    assert.equal(parseInt(provResAAmtNew.value.amount), parseInt(provResAAmt.value.amount)-amountA);
    assert.equal(parseInt(provResBAmtNew.value.amount), parseInt(provResBAmt.value.amount)-amountB);

  })

  it("Remove Liquidity", async () => {

    let liqBurnAmt = 2e9;

    let resAAmt = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmt = await program.provider.connection.getTokenAccountBalance(reserveB);
    let provResAAmt = await program.provider.connection.getTokenAccountBalance(providerResA);
    let provResBAmt = await program.provider.connection.getTokenAccountBalance(providerResB);
    let liqShare = await program.provider.connection.getTokenAccountBalance(providerResPool);
    let poolMintAcct = await getMint(program.provider.connection, poolMint.publicKey);

    
    let protocolLiqTip = (liqBurnAmt * tipNum.toNumber()) / tipDenom.toNumber();
    let adjLiqBurn = liqBurnAmt - protocolLiqTip;
    let retAmtA = (adjLiqBurn * parseInt(resAAmt.value.amount)) / Number(poolMintAcct.supply);
    let retAmtB = (adjLiqBurn * parseInt(resBAmt.value.amount)) / Number(poolMintAcct.supply);

    let tx_hash = await program.methods.removeLiquidity(new anchor.BN(liqBurnAmt))
    .accounts({
          provider: liqProvider.publicKey,
          exchangeAuthority: exchangeAuthPda,
          helio: helioPair.publicKey,
          reserveA: reserveA,
          reserveB: reserveB,
          feeReserve: feeReserve,
          poolMint: poolMint.publicKey,
          providerReserveA: providerResA,
          providerReserveB: providerResB,
          providerPoolReserve: providerResPool,
          poolState: liqPool.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([liqProvider]).rpc({skipPreflight: true, commitment: 'confirmed'})
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });

    console.log("Your transaction signature", tx_hash);

    let liqShareNew = await program.provider.connection.getTokenAccountBalance(providerResPool);
    let resAAmtNew = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmtNew = await program.provider.connection.getTokenAccountBalance(reserveB);
    let provResAAmtNew = await program.provider.connection.getTokenAccountBalance(providerResA);
    let provResBAmtNew = await program.provider.connection.getTokenAccountBalance(providerResB);
    let feeReserveAmt = await program.provider.connection.getTokenAccountBalance(feeReserve);

    assert.equal(parseInt(liqShareNew.value.amount), parseInt(liqShare.value.amount) - adjLiqBurn - protocolLiqTip);
    assert.equal(parseInt(feeReserveAmt.value.amount), protocolLiqTip);
    assert.equal(parseInt(resAAmtNew.value.amount), parseInt(resAAmt.value.amount) - retAmtA);
    assert.equal(parseInt(resBAmtNew.value.amount), parseInt(resBAmt.value.amount) - retAmtB);
    assert.equal(parseInt(provResAAmtNew.value.amount), parseInt(provResAAmt.value.amount) + retAmtA);
    assert.equal(parseInt(provResBAmtNew.value.amount), parseInt(provResBAmt.value.amount) + retAmtB);


  });

  it("Swap Tokens", async () => {

    let amountIn = 3e9;

    let resAAmt = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmt = await program.provider.connection.getTokenAccountBalance(reserveB);
    let provResAAmt = await program.provider.connection.getTokenAccountBalance(providerResA);
    let provResBAmt = await program.provider.connection.getTokenAccountBalance(providerResB);

    let deltaA = (lpRewardNum.toNumber() * Math.trunc(amountIn)) / lpRewardDenom.toNumber();
    let numerator = parseInt(resBAmt.value.amount) * deltaA;
    let denominator = parseInt(resAAmt.value.amount) + deltaA;
    let amountOut = Math.floor(numerator / denominator);

    console.log(amountOut);

    let tx_hash = await program.methods.swap(new anchor.BN(amountIn))
    .accounts({
          trader: liqProvider.publicKey,
          reserveA: reserveA,
          reserveB: reserveB,
          traderReserveA: providerResA,
          traderReserveB: providerResB,
          exchangeAuthority: exchangeAuthPda,
          helio: helioPair.publicKey,
          poolState: liqPool.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([liqProvider]).rpc({skipPreflight: true, commitment: 'confirmed'})
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });

    console.log("Your transaction signature", tx_hash);

    let resAAmtNew = await program.provider.connection.getTokenAccountBalance(reserveA);
    let resBAmtNew = await program.provider.connection.getTokenAccountBalance(reserveB);
    let provResAAmtNew = await program.provider.connection.getTokenAccountBalance(providerResA);
    let provResBAmtNew = await program.provider.connection.getTokenAccountBalance(providerResB);

    assert.equal(parseInt(resAAmtNew.value.amount), parseInt(resAAmt.value.amount) + amountIn);
    assert.equal(parseInt(resBAmtNew.value.amount), parseInt(resBAmt.value.amount) - amountOut);
    assert.equal(parseInt(provResAAmtNew.value.amount), parseInt(provResAAmt.value.amount) - amountIn);
    assert.equal(parseInt(provResBAmtNew.value.amount), parseInt(provResBAmt.value.amount) + amountOut);

  });

  

});
