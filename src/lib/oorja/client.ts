import haversine from 'haversine-distance'

export class OorjaClientError extends Error {}

const _maybeError = (response: Response) => {
  const {status} = response
  if (status >= 400) {
    throw new OorjaClientError('oorja network client error')
  }
}

class Client {
  async get(
    url: string,
    options: {
      headers?: {[key: string]: string}
      method?: string
      timeout?: number
    } = {},
  ) {
    const response = await fetch(url, {
      ...options,
      method: options.method || 'GET',
      headers: {...options.headers},
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(options.timeout || 6_000),
    })
    _maybeError(response)
    return response
  }
}

const _client = new Client()

type _Settings = {
  version: string
  lastUpdated: string
  regions: {
    name: string
    location: {
      lat: number
      lng: number
    }
  }[]
}

export const getRegion = async (): Promise<string> => {
  const response = await _client.get('https://oorja.io/nudge', {
    method: 'GET',
  })
  if (response.status !== 200) {
    console.error('There seems to be an issue with the network')
    process.exit(1)
  }
  const settings = (await response.json()) as _Settings
  try {
    const clientLocation = {
      lat: parseFloat(response.headers.get('oorja-lat')!),
      lng: parseFloat(response.headers.get('oorja-lon')!),
    }
    const distances = settings.regions.map((region) => {
      return {
        name: region.name,
        distance: haversine(clientLocation, region.location),
      }
    })
    const minDistance = distances.reduce((a, b) => (a.distance < b.distance ? a : b))
    return minDistance.name
  } catch {
    console.error('error determining region')
    process.exit(1)
  }
}
