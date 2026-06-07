import haversine from 'haversine-distance'
import {printExitMessage} from 'oorja/lib/utils'
import {exit} from 'oorja/lib/exit'
import {geoMap} from 'oorja/lib/oorja/geoMap'

export class OorjaClientError extends Error {}

const _maybeError = (response: Response) => {
  const {status} = response
  if (status >= 400) {
    throw new OorjaClientError('SupaKit network client error')
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
  const response = await _client.get('https://supakit.app/nudge', {
    method: 'GET',
  })
  if (response.status !== 200) {
    printExitMessage('There seems to be an issue with the network')
    exit(1)
    return Promise.reject()
  }
  const settings = (await response.json()) as _Settings
  const country = (response.headers.get('cdn-requestcountrycode') || 'us').toUpperCase().trim() as keyof typeof geoMap

  const info = geoMap[country] || geoMap['US']

  try {
    const clientLocation = {
      lat: parseFloat(info[0]),
      lng: parseFloat(info[1]),
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
    printExitMessage('error determining region')
    exit(1)
    return Promise.reject()
  }
}
