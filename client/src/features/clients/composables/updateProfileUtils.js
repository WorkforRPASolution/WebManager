export function filterProfilesByClientOs(profiles, clientOsVersions) {
  if (!clientOsVersions.length) return profiles
  return profiles.filter(p => !p.osVer || clientOsVersions.includes(p.osVer))
}
