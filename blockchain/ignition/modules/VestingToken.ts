import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("VestingTokenModule", (m) => {
  const deployer = m.getAccount(0);
  const initialMintAmount = m.getParameter(
    "initialMintAmount",
    10_000n * 10n ** 18n,
  );
  const vestingToken = m.contract("VestingToken");

  m.call(vestingToken, "mint", [deployer, initialMintAmount]);

  return { vestingToken };
});
