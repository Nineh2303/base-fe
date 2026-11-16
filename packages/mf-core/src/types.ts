export interface RemoteEntry {
  name: string
  entry: string
  routePrefix: string
  critical?: boolean
  menu?: { label: string; order?: number }
}

export interface RemotesManifest {
  remotes: RemoteEntry[]
}

export interface RemoteMeta {
  name: string
  coreVersion: string
}
