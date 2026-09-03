import { Prisma } from "@prisma/client";
import { REGISTER_PRODUCTS, type RegisterProductCode, type RegisterProductGroup } from "@iocl/shared";

type QuantitySums = Partial<Record<(typeof REGISTER_PRODUCTS)[number]["field"], Prisma.Decimal | null>>;

export function buildQuantitySummary(sums: QuantitySums) {
  const values = Object.fromEntries(REGISTER_PRODUCTS.map((product) => [
    product.code,
    sums[product.field] ?? new Prisma.Decimal(0),
  ])) as Record<RegisterProductCode, Prisma.Decimal>;

  const groupTotal = (group: RegisterProductGroup) => REGISTER_PRODUCTS
    .filter((product) => product.group === group)
    .reduce((total, product) => total.add(values[product.code]), new Prisma.Decimal(0));

  return {
    ms: values.MS.toString(),
    xpms: values.XPMS.toString(),
    ebms: values.EBMS.toString(),
    hsd: values.HSD.toString(),
    sko: values.SKO.toString(),
    xg: values.XG.toString(),
    bioHsd: values.BIO_HSD.toString(),
    fo: values.FO.toString(),
    ldo: values.LDO.toString(),
    petrol: groupTotal("PETROL").toString(),
    diesel: groupTotal("DIESEL").toString(),
    other: groupTotal("OTHER").toString(),
  };
}
