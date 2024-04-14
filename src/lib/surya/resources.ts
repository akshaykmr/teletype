import camelcaseKeys from "camelcase-keys";

const parseDateFields = (
  resource: any,
  fields = ["createdAt", "updatedAt"]
) => {
  fields.forEach((key) => {
    const val = resource[key];
    if (val) resource[key] = new Date(val);
  });
  return resource;
};
const camelCaseFields = (resource: any) =>
  camelcaseKeys(resource, { deep: true });

function mkPipe(...fns: any) {
  return (initVal: any) => fns.reduce((r: any, f: any) => f(r), initVal);
}

// TODO: replace this shit with Pipe Operator if it ever lands.
// Also, remove usage of any types
export const defaultParser = mkPipe(camelCaseFields, parseDateFields);
