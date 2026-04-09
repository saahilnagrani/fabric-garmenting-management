export function validateFabricOrder(
  data: Record<string, unknown>
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!data.fabricVendorId) errors.fabricVendorId = "Vendor is required";
  if (!data.articleNumbers) errors.articleNumbers = "Article numbers required";
  if (!data.fabricName) errors.fabricName = "Fabric name required";
  if (!data.colour) errors.colour = "Colour required";
  return Object.keys(errors).length > 0 ? errors : null;
}

export function validateExpense(
  data: Record<string, unknown>
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!data.specification) errors.specification = "Type is required";
  if (!data.amount && data.amount !== 0) errors.amount = "Amount is required";
  return Object.keys(errors).length > 0 ? errors : null;
}

export function validateProduct(
  data: Record<string, unknown>
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!data.styleNumber) errors.styleNumber = "Style number required";
  if (!data.type) errors.type = "Type required";
  if (!data.gender) errors.gender = "Gender required";
  if (!data.fabricVendorId) errors.fabricVendorId = "Vendor required";
  if (!data.fabricName) errors.fabricName = "Fabric name required";
  if (!data.colourOrdered) errors.colourOrdered = "Colour required";
  return Object.keys(errors).length > 0 ? errors : null;
}

export function validateFabricMaster(
  data: Record<string, unknown>
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!data.fabricName) errors.fabricName = "Fabric name required";
  if (!data.vendorId) errors.vendorId = "Vendor required";
  return Object.keys(errors).length > 0 ? errors : null;
}

export function validateProductMaster(
  data: Record<string, unknown>
): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!data.skuCode) errors.skuCode = "SKU Code required";
  if (!data.styleNumber) errors.styleNumber = "Style number required";
  if (!data.type) errors.type = "Type required";
  if (!data.gender) errors.gender = "Gender required";
  if (!data.fabricName) errors.fabricName = "Fabric name required";
  return Object.keys(errors).length > 0 ? errors : null;
}
