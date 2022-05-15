// Migrations are an early feature. Currently, they're nothing more than this
// single deploy script that's invoked from the CLI, injecting a provider
// configured from the workspace's Anchor.toml.

import * as anchor from "@project-serum/anchor";
import { createInitializeMintInstruction, getMinimumBalanceForRentExemptAccount, MINT_SIZE, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js";
import { readFileSync, writeFileSync } from 'fs';


const initMarket = async(program: anchor.Program<any>, lpRewardNum: anchor.BN, lpRewardDenom: anchor.BN, exchangeAuthPda: anchor.web3.PublicKey, helioPair: Keypair) => {
  

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

}

  const createMint = async(mintKeypair: anchor.web3.Keypair, mintAuth: anchor.web3.PublicKey, program: anchor.Program<any>) => {

    let mintTx = new Transaction().add(
      // create mint account
      SystemProgram.createAccount({
        fromPubkey: program.provider.wallet.publicKey,
        newAccountPubkey: mintKeypair.publicKey,
        space: MINT_SIZE,
        lamports: await getMinimumBalanceForRentExemptAccount(program.provider.connection),
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

    console.log(`Your transaction signature: ${await program.provider.send(mintTx, [mintKeypair])}`);
  }

  const initPool = async(exchangeAuthPda: anchor.web3.PublicKey, program: anchor.Program<any>, tipNum: anchor.BN, tipDenom: anchor.BN) => {
    let liqPool = anchor.web3.Keypair.generate();

    let reserveAMint = anchor.web3.Keypair.generate();
    let reserveBMint = anchor.web3.Keypair.generate();
    let poolMint = anchor.web3.Keypair.generate();

    createMint(reserveAMint, program.provider.wallet.publicKey, program);
    createMint(reserveBMint, program.provider.wallet.publicKey, program);
    createMint(poolMint, exchangeAuthPda, program);

    let [reserveA] = await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_a")), liqPool.publicKey.toBuffer()],
          program.programId
      );

    let [reserveB] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_b")), liqPool.publicKey.toBuffer()],
        program.programId
    );

    let [feeReserve] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("fee_reserve")), liqPool.publicKey.toBuffer()],
        program.programId
    );


    let liqProvider = anchor.web3.Keypair.generate();

    const airDropSign = await program.provider.connection.requestAirdrop(
          liqProvider.publicKey,
          anchor.web3.LAMPORTS_PER_SOL*1000
    );

    await program.provider.connection.confirmTransaction(airDropSign);


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
  }

const initPool2 = async (exchangeAuthPda: anchor.web3.PublicKey, program: anchor.Program<any>, tipNum: anchor.BN, tipDenom: anchor.BN, reserveAMint: PublicKey, reserveBMint: PublicKey) => {
  let liqPool = anchor.web3.Keypair.generate();

  let poolMint = anchor.web3.Keypair.generate();

  createMint(poolMint, exchangeAuthPda, program);

  let [reserveA] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_a")), liqPool.publicKey.toBuffer()],
    program.programId
  );

  let [reserveB] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_b")), liqPool.publicKey.toBuffer()],
    program.programId
  );

  let [feeReserve] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("fee_reserve")), liqPool.publicKey.toBuffer()],
    program.programId
  );


  let liqProvider = anchor.web3.Keypair.generate();

  const airDropSign = await program.provider.connection.requestAirdrop(
    liqProvider.publicKey,
    anchor.web3.LAMPORTS_PER_SOL * 1000
  );

  await program.provider.connection.confirmTransaction(airDropSign);


  const tx = await program.methods.initializePool(tipNum, tipDenom)
    .accounts({
      payer: liqProvider.publicKey,
      poolState: liqPool.publicKey,
      exchangeAuthority: exchangeAuthPda,
      reserveA: reserveA,
      reserveB: reserveB,
      feeReserve: feeReserve,
      mintA: reserveAMint,
      mintB: reserveBMint,
      poolMint: poolMint.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY
    })
    .signers([liqProvider, liqPool]).rpc({ skipPreflight: true, commitment: 'confirmed' })
    .catch((error: Error) => {
      console.error(error);
      process.exit(1);
    });

  console.log("Your transaction signature", tx);
}


module.exports = async function (provider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);
  let secretKey = readFileSync('../target/deploy/helio_dex-keypair.json', 'utf8');
  const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(secretKey.substring(1, secretKey.length - 1).split(",").map((i) => Number(i))));
  const idl = JSON.parse(
    readFileSync("../target/idl/helio_dex.json", "utf8")
  );

  const program = new anchor.Program(idl, "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

  let lpRewardNum = new anchor.BN(997);
  let lpRewardDenom = new anchor.BN(1000);

  let [exchangeAuthPda] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(anchor.utils.bytes.utf8.encode("exchange_authority")), program.provider.wallet.publicKey.toBuffer()],
        program.programId
  );

  let tipNum = new anchor.BN(5);
  let tipDenom = new anchor.BN(10000);

  let helioPair = anchor.web3.Keypair.generate();

  initMarket(program, lpRewardNum, lpRewardDenom, exchangeAuthPda, helioPair);

  /*initPool(exchangeAuthPda, program, tipNum, tipDenom);
  initPool(exchangeAuthPda, program, tipNum, tipDenom);
  initPool(exchangeAuthPda, program, tipNum, tipDenom);
  initPool(exchangeAuthPda, program, tipNum, tipDenom);
  initPool(exchangeAuthPda, program, tipNum, tipDenom);
  initPool(exchangeAuthPda, program, tipNum, tipDenom);
  initPool(exchangeAuthPda, program, tipNum, tipDenom);*/

  let reserveAMint = anchor.web3.Keypair.generate();
  let reserveBMint = anchor.web3.Keypair.generate();
  let reserveCMint = anchor.web3.Keypair.generate();
  let reserveDMint = anchor.web3.Keypair.generate();

  createMint(reserveAMint, program.provider.wallet.publicKey, program);
  createMint(reserveBMint, program.provider.wallet.publicKey, program);
  createMint(reserveCMint, program.provider.wallet.publicKey, program);
  createMint(reserveDMint, program.provider.wallet.publicKey, program);

  console.log("TOKENA: ", reserveAMint.publicKey.toBase58());
  console.log("TOKENB: ", reserveBMint.publicKey.toBase58());
  console.log("TOKENC: ", reserveCMint.publicKey.toBase58());
  console.log("TOKEND: ", reserveDMint.publicKey.toBase58());

  writeFileSync('/mnt/c/Users/Saul Acevedo/Documents/solana_dapps/helio_dex/app/.env.local', `REACT_APP_EXCHANGE_AUTH=${exchangeAuthPda}\nREACT_APP_MARKET=${helioPair.publicKey}\nREACT_APP_MINT_TOKEN_A=${reserveAMint.publicKey.toBase58()}\nREACT_APP_MINT_TOKEN_B=${reserveBMint.publicKey.toBase58()}\nREACT_APP_MINT_TOKEN_C=${reserveCMint.publicKey.toBase58()}\nREACT_APP_MINT_TOKEN_D=${reserveDMint.publicKey.toBase58()}\nREACT_APP_RPC_URL=http://127.0.0.1:8899`);


};
