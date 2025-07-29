import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Upload, FileText, Download, AlertCircle, CheckCircle, ChevronDown, ChevronRight, Buildings, GitBranch, User, MagnifyingGlass, FunnelSimple, X, Database, CloudArrowDown, Key, Globe, CaretDown } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useKV } from '@github/spark/hooks'

interface Resource {
  type: 'Org' | 'Repo' | 'User'
  name: string
}

interface CostCenter {
  id: string
  name: string
  state: 'active' | 'deleted'
  resources: Resource[]
}

interface ParsedData {
  costCenters: CostCenter[]
  activeCostCenters: CostCenter[]
  deletedCostCenters: CostCenter[]
  summary: {
    totalActive: number
    totalDeleted: number
    totalOrganizations: number
    totalRepositories: number
    totalMembers: number
  }
}

interface GitHubAPIConfig {
  token: string
  enterprise: string
}

function App() {
  const [jsonData, setJsonData] = useState<ParsedData | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedCenters, setExpandedCenters] = useState<Set<string>>(new Set())
  const [isDragOver, setIsDragOver] = useState(false)
  
  // API Configuration - persisted in KV store
  const [apiConfig, setApiConfig] = useKV<GitHubAPIConfig | null>('github-api-config', null)
  const [tempToken, setTempToken] = useState('')
  const [tempEnterprise, setTempEnterprise] = useState('')
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [resourceTypeFilter, setResourceTypeFilter] = useState<'all' | 'Org' | 'Repo' | 'User'>('all')
  const [hasResourcesFilter, setHasResourcesFilter] = useState<'all' | 'with-resources' | 'empty'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'total-resources' | 'orgs' | 'repos' | 'users'>('name')

  const fetchFromAPI = async () => {
    if (!apiConfig?.token || !apiConfig?.enterprise) {
      setError('Please configure your GitHub API token and enterprise slug first')
      toast.error('API configuration required')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch(`https://api.github.com/enterprises/${apiConfig.enterprise}/settings/billing/cost-centers`, {
        headers: {
          'Authorization': `token ${apiConfig.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your GitHub token.')
        } else if (response.status === 403) {
          throw new Error('Access denied. You may not have permission to access this enterprise\'s cost centers.')
        } else if (response.status === 404) {
          throw new Error('Enterprise not found. Please check your enterprise slug.')
        } else {
          throw new Error(`API request failed with status ${response.status}`)
        }
      }

      const rawData = await response.json()
      const processedData = processJsonData(rawData)
      setJsonData(processedData)
      toast.success('Cost center data fetched successfully from GitHub API!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data from GitHub API'
      setError(errorMessage)
      toast.error('Failed to fetch from API')
    } finally {
      setIsLoading(false)
    }
  }

  const saveAPIConfigAndFetch = async () => {
    if (!tempToken.trim()) {
      setError('GitHub Personal Access Token is required')
      toast.error('Please enter your GitHub token')
      return
    }
    
    if (!tempEnterprise.trim()) {
      setError('Enterprise slug is required')
      toast.error('Please enter your enterprise slug')
      return
    }

    setError('') // Clear any previous errors
    setIsLoading(true)
    
    const newConfig = {
      token: tempToken.trim(),
      enterprise: tempEnterprise.trim()
    }
    
    // Save the configuration
    setApiConfig(newConfig)
    
    // Clear temporary values for security
    setTempToken('')
    setTempEnterprise('')
    
    toast.success('Configuration saved! Fetching data...')

    // Immediately fetch data with the new configuration
    try {
      const response = await fetch(`https://api.github.com/enterprises/${newConfig.enterprise}/settings/billing/cost-centers`, {
        headers: {
          'Authorization': `token ${newConfig.token}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your GitHub token.')
        } else if (response.status === 403) {
          throw new Error('Access denied. You may not have permission to access this enterprise\'s cost centers.')
        } else if (response.status === 404) {
          throw new Error('Enterprise not found. Please check your enterprise slug.')
        } else {
          throw new Error(`API request failed with status ${response.status}`)
        }
      }

      const rawData = await response.json()
      const processedData = processJsonData(rawData)
      setJsonData(processedData)
      toast.success('Cost center data fetched successfully from GitHub API!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data from GitHub API'
      setError(errorMessage)
      toast.error('Failed to fetch from API')
    } finally {
      setIsLoading(false)
    }
  }

  const clearAPIConfig = () => {
    setApiConfig(null)
    setTempToken('')
    setTempEnterprise('')
    setError('') // Clear any error messages
    toast.success('API configuration cleared')
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    await processFile(file)
  }

  const processFile = async (file: File) => {
    setIsLoading(true)
    setError('')
    
    try {
      const text = await file.text()
      const rawData = JSON.parse(text)
      
      // Process the JSON data
      const processedData = processJsonData(rawData)
      setJsonData(processedData)
      toast.success('JSON data processed successfully!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse JSON file'
      setError(errorMessage)
      toast.error('Failed to process file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    const files = Array.from(event.dataTransfer.files)
    const jsonFile = files.find(file => file.type === 'application/json' || file.name.endsWith('.json'))
    
    if (!jsonFile) {
      setError('Please drop a JSON file')
      toast.error('Please drop a JSON file')
      return
    }

    await processFile(jsonFile)
  }

  const processJsonData = (rawData: any): ParsedData => {
    let costCenters: CostCenter[] = []
    
    // Handle the expected JSON structure with costCenters array
    if (rawData.costCenters && Array.isArray(rawData.costCenters)) {
      costCenters = rawData.costCenters
    } else if (Array.isArray(rawData)) {
      costCenters = rawData
    } else {
      throw new Error('Invalid JSON structure. Expected an object with costCenters property containing an array.')
    }

    // Validate cost centers structure
    const processedCenters = costCenters.map((center, index) => {
      if (!center.id || !center.name || !center.state || !Array.isArray(center.resources)) {
        throw new Error(`Invalid cost center at index ${index}. Expected id, name, state, and resources array.`)
      }
      return center
    })

    // Separate active and deleted cost centers
    const activeCostCenters = processedCenters.filter(center => center.state === 'active')
    const deletedCostCenters = processedCenters.filter(center => center.state === 'deleted')

    // Calculate organizational metrics for active cost centers
    let totalOrganizations = 0
    let totalRepositories = 0
    let totalMembers = 0

    activeCostCenters.forEach(center => {
      center.resources.forEach(resource => {
        switch (resource.type) {
          case 'Org':
            totalOrganizations++
            break
          case 'Repo':
            totalRepositories++
            break
          case 'User':
            totalMembers++
            break
        }
      })
    })

    return {
      costCenters: processedCenters,
      activeCostCenters,
      deletedCostCenters,
      summary: { 
        totalActive: activeCostCenters.length,
        totalDeleted: deletedCostCenters.length,
        totalOrganizations,
        totalRepositories,
        totalMembers
      }
    }
  }

  const loadExampleData = () => {
    setIsLoading(true)
    setError('')

    // Mock data based on your provided JSON schema
    const mockData = {
      costCenters: [
        {
          id: "78b18988-0df4-4118-bda8-8167132a2256",
          name: "still-First",
          state: "active",
          resources: [
            {
              type: "Repo",
              name: "bryant-test-org/blobfuse-test"
            }
          ]
        },
        {
          id: "d8a3b08b-02fd-4c87-91fd-dad18e71b7a7",
          name: "el-segundo", 
          state: "active",
          resources: [
            {
              type: "User",
              name: "gregoriousmonk"
            },
            {
              type: "Org",
              name: "gmondello-temp-test"
            }
          ]
        },
        {
          id: "c59f5d06-6ecc-44a9-bbef-a40e398b4392",
          name: "123123123",
          state: "deleted",
          resources: []
        },
        {
          id: "3b080bd5-f253-4671-b77d-3558805b4fca",
          name: "ServiceID_1234567",
          state: "active",
          resources: []
        },
        {
          id: "50d1ac75-20ac-436d-8e43-8a07e8cc7577",
          name: "mp-test",
          state: "active",
          resources: [
            {
              type: "Repo",
              name: "10k-repos/test-public"
            }
          ]
        },
        {
          id: "84b98dc5-04c5-4400-9e21-4b785b15757e",
          name: "test-subset-km",
          state: "active", 
          resources: [
            {
              type: "Org",
              name: "Avocado-Extra-Charge"
            }
          ]
        },
        {
          id: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
          name: "Marketing Division",
          state: "active",
          resources: [
            {
              type: "Org",
              name: "marketing-team"
            },
            {
              type: "Repo", 
              name: "marketing-team/website"
            },
            {
              type: "Repo",
              name: "marketing-team/campaigns"
            },
            {
              type: "User",
              name: "sarah.marketing"
            },
            {
              type: "User",
              name: "john.designer"
            },
            {
              type: "User",
              name: "mike.content"
            }
          ]
        },
        {
          id: "f9e8d7c6-b5a4-9384-7261-504938271650",
          name: "Engineering Hub",
          state: "active",
          resources: [
            {
              type: "Org",
              name: "engineering-core"
            },
            {
              type: "Org", 
              name: "engineering-platform"
            },
            {
              type: "Repo",
              name: "engineering-core/api-gateway"
            },
            {
              type: "Repo",
              name: "engineering-core/user-service"
            },
            {
              type: "Repo",
              name: "engineering-platform/deployment-tools"
            },
            {
              type: "User",
              name: "alice.architect"
            },
            {
              type: "User",
              name: "bob.backend"
            },
            {
              type: "User",
              name: "charlie.devops"
            },
            {
              type: "User",
              name: "diana.frontend"
            }
          ]
        },
        {
          id: "5a4b3c2d-1e0f-9876-5432-1098765fedcb",
          name: "Research Lab",
          state: "active",
          resources: [
            {
              type: "Repo",
              name: "research-lab/ml-experiments"
            },
            {
              type: "Repo",
              name: "research-lab/data-analysis"
            },
            {
              type: "User",
              name: "dr.researcher"
            }
          ]
        },
        {
          id: "9z8y7x6w-5v4u-3t2s-1r0q-9p8o7n6m5l4k",
          name: "Legacy Project Alpha",
          state: "deleted",
          resources: []
        },
        {
          id: "1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p",
          name: "Legacy Project Beta", 
          state: "deleted",
          resources: []
        }
      ]
    }

    try {
      const processedData = processJsonData(mockData)
      setJsonData(processedData)
      toast.success('Example data loaded successfully!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load example data'
      setError(errorMessage)
      toast.error('Failed to load example data')
    } finally {
      setIsLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getResourceCounts = (center: CostCenter) => {
    const orgs = center.resources.filter(r => r.type === 'Org').length
    const repos = center.resources.filter(r => r.type === 'Repo').length
    const members = center.resources.filter(r => r.type === 'User').length
    return { orgs, repos, members }
  }

  const toggleCenterExpansion = (centerId: string) => {
    const newExpanded = new Set(expandedCenters)
    if (newExpanded.has(centerId)) {
      newExpanded.delete(centerId)
    } else {
      newExpanded.add(centerId)
    }
    setExpandedCenters(newExpanded)
  }

  const getResourcesByType = (center: CostCenter) => {
    const orgs = center.resources.filter(r => r.type === 'Org')
    const repos = center.resources.filter(r => r.type === 'Repo')
    const users = center.resources.filter(r => r.type === 'User')
    return { orgs, repos, users }
  }

  // Enhanced filtering and search logic
  const filteredAndSortedCostCenters = useMemo(() => {
    if (!jsonData) return []

    let filtered = jsonData.activeCostCenters.filter(center => {
      // Search filter - check cost center name, ID, and resource names
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = !searchQuery || 
        center.name.toLowerCase().includes(searchLower) ||
        center.id.toLowerCase().includes(searchLower) ||
        center.resources.some(resource => 
          resource.name.toLowerCase().includes(searchLower)
        )

      // Resource type filter
      const matchesResourceType = resourceTypeFilter === 'all' || 
        center.resources.some(resource => resource.type === resourceTypeFilter)

      // Has resources filter
      const matchesHasResources = hasResourcesFilter === 'all' ||
        (hasResourcesFilter === 'with-resources' && center.resources.length > 0) ||
        (hasResourcesFilter === 'empty' && center.resources.length === 0)

      return matchesSearch && matchesResourceType && matchesHasResources
    })

    // Sort the filtered results
    filtered.sort((a, b) => {
      const { orgs: aOrgs, repos: aRepos, members: aMembers } = getResourceCounts(a)
      const { orgs: bOrgs, repos: bRepos, members: bMembers } = getResourceCounts(b)

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'total-resources':
          return (b.resources.length) - (a.resources.length)
        case 'orgs':
          return bOrgs - aOrgs
        case 'repos':
          return bRepos - aRepos
        case 'users':
          return bMembers - aMembers
        default:
          return a.name.localeCompare(b.name)
      }
    })

    return filtered
  }, [jsonData, searchQuery, resourceTypeFilter, hasResourcesFilter, sortBy])

  const clearFilters = () => {
    setSearchQuery('')
    setResourceTypeFilter('all')
    setHasResourcesFilter('all')
    setSortBy('name')
  }

  const hasActiveFilters = searchQuery || resourceTypeFilter !== 'all' || hasResourcesFilter !== 'all' || sortBy !== 'name'

  const exportReport = (format: 'json' | 'csv') => {
    if (!jsonData) return
    
    if (format === 'json') {
      const reportData = {
        generatedAt: new Date().toISOString(),
        summary: jsonData.summary,
        costCenters: jsonData.costCenters.map(center => ({
          ...center,
          resourceCounts: getResourceCounts(center)
        }))
      }
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cost-center-report-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('JSON report exported successfully!')
    } else if (format === 'csv') {
      // Create CSV headers
      const headers = [
        'Cost Center Name',
        'Cost Center ID',
        'State',
        'Total Resources',
        'Organizations',
        'Repositories',
        'Members'
      ]
      
      const rows = jsonData.costCenters.map(center => {
        const { orgs, repos, members } = getResourceCounts(center)
        
        return [
          `"${center.name}"`,
          center.id,
          center.state,
          center.resources.length,
          orgs,
          repos,
          members
        ]
      })
      
      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cost-center-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('CSV report exported successfully!')
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Cost Center Analyzer</h1>
          <p className="text-muted-foreground">Fetch data via GitHub API directly or upload JSON results to search cost center names and members and get reports</p>
        </div>

        {/* Upload Section */}
        <Card className="mb-6">
          {!jsonData ? (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Load Cost Center Data
                </CardTitle>
                <CardDescription>
                  Fetch data directly from GitHub API or upload a JSON file containing cost center data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
                  <div>
                    <p className="text-sm text-muted-foreground">Don't have cost center data yet?</p>
                    <p className="text-xs text-muted-foreground mt-1">Try the application with sample data to explore features</p>
                  </div>
                  <Button 
                    onClick={loadExampleData} 
                    variant="outline" 
                    size="sm"
                    className="flex items-center gap-2"
                    disabled={isLoading}
                  >
                    <Database className="h-4 w-4" />
                    Load Example Data
                  </Button>
                </div>

                <Tabs defaultValue="api" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="api" className="flex items-center gap-2">
                      <CloudArrowDown className="h-4 w-4" />
                      GitHub API
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Upload File
                    </TabsTrigger>
                  </TabsList>

                  {/* GitHub API Tab */}
                  <TabsContent value="api" className="space-y-4">
                    {!apiConfig ? (
                      <div className="space-y-4">
                        <Alert>
                          <Key className="h-4 w-4" />
                          <AlertDescription>
                            Configure your GitHub credentials to fetch cost center data directly from the API.
                            You'll need a personal access token with `manage_billing:enterprise` scope.
                          </AlertDescription>
                        </Alert>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                              GitHub Personal Access Token
                            </label>
                            <Input
                              type="password"
                              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                              value={tempToken}
                              onChange={(e) => setTempToken(e.target.value)}
                              className="font-mono"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Required scopes: manage_billing:enterprise
                            </p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                              Enterprise Slug
                            </label>
                            <Input
                              placeholder="your-enterprise"
                              value={tempEnterprise}
                              onChange={(e) => setTempEnterprise(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Found in your enterprise URL
                            </p>
                          </div>
                        </div>
                        
                        <Button onClick={saveAPIConfigAndFetch} disabled={isLoading} className="flex items-center gap-2">
                          <Key className="h-4 w-4" />
                          {isLoading ? 'Saving & Fetching...' : 'Save Configuration & Fetch Data'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            API configured for enterprise: <code className="font-mono">{apiConfig.enterprise}</code>
                          </AlertDescription>
                        </Alert>
                        
                        <div className="flex items-center gap-3">
                          <Button 
                            onClick={fetchFromAPI} 
                            disabled={isLoading}
                            className="flex items-center gap-2"
                          >
                            <CloudArrowDown className="h-4 w-4" />
                            {isLoading ? 'Fetching...' : 'Fetch from GitHub API'}
                          </Button>
                          
                          <Button variant="outline" onClick={clearAPIConfig}>
                            Clear Configuration
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* File Upload Tab */}
                  <TabsContent value="file" className="space-y-4">
                    <div className="flex items-center justify-center w-full">
                      <div
                        className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          isDragOver 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:bg-muted/50'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-upload')?.click()}
                      >
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <FileText className={`w-8 h-8 mb-3 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className="mb-2 text-sm text-muted-foreground">
                            <span className="font-semibold">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground">JSON files only</p>
                        </div>
                        <input
                          id="file-upload"
                          type="file"
                          className="hidden"
                          accept=".json"
                          onChange={handleFileUpload}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                
                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <CardTitle className="text-lg">Data Loaded Successfully</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setJsonData(null)
                        setError('')
                      }}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Load New Data
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  Found {jsonData.activeCostCenters.length} active and {jsonData.deletedCostCenters.length} deleted cost centers. 
                  {apiConfig && (
                    <span className="ml-1">Loaded from GitHub API for enterprise: <code className="font-mono text-xs">{apiConfig.enterprise}</code></span>
                  )}
                </p>
              </CardContent>
            </>
          )}
        </Card>

        {/* Results Section */}
        {jsonData && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Cost Centers</p>
                      <p className="text-2xl font-bold text-primary">{jsonData.summary.totalActive}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Deleted Cost Centers</p>
                      <p className="text-2xl font-bold text-muted-foreground">{jsonData.summary.totalDeleted}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Organizations</p>
                      <p className="text-2xl font-bold">{formatNumber(jsonData.summary.totalOrganizations)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Repositories</p>
                      <p className="text-2xl font-bold">{formatNumber(jsonData.summary.totalRepositories)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Resource Summary</CardTitle>
                  <CardDescription>Overview of organizations, repositories, and members across active cost centers</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export Report
                      <CaretDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => exportReport('json')}>
                      <FileText className="h-4 w-4 mr-2" />
                      Export as JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportReport('csv')}>
                      <Download className="h-4 w-4 mr-2" />
                      Export as CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{formatNumber(jsonData.summary.totalOrganizations)}</div>
                    <div className="text-sm text-muted-foreground">Organizations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-accent">{formatNumber(jsonData.summary.totalRepositories)}</div>
                    <div className="text-sm text-muted-foreground">Repositories</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{formatNumber(jsonData.summary.totalMembers)}</div>
                    <div className="text-sm text-muted-foreground">Members</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Cost Centers Table with Resource Details */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Active Cost Centers - Resource Breakdown</CardTitle>
                    <CardDescription>
                      {filteredAndSortedCostCenters.length} of {jsonData.activeCostCenters.length} cost centers
                      {hasActiveFilters && ' (filtered)'}
                    </CardDescription>
                  </div>
                </div>
                
                {/* Search and Filter Controls */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                      <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search cost centers, IDs, or resource names..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    
                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                      <Button variant="outline" onClick={clearFilters} className="flex items-center gap-2">
                        <X className="h-4 w-4" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Resource Type Filter */}
                    <div className="flex items-center gap-2">
                      <FunnelSimple className="h-4 w-4 text-muted-foreground" />
                      <Select value={resourceTypeFilter} onValueChange={(value: any) => setResourceTypeFilter(value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Resource Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Resources</SelectItem>
                          <SelectItem value="Org">Organizations</SelectItem>
                          <SelectItem value="Repo">Repositories</SelectItem>
                          <SelectItem value="User">Users</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Has Resources Filter */}
                    <Select value={hasResourcesFilter} onValueChange={(value: any) => setHasResourcesFilter(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Resource Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All cost centers</SelectItem>
                        <SelectItem value="with-resources">Cost centers with resources</SelectItem>
                        <SelectItem value="empty">Empty cost centers</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* Sort By */}
                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Sort By" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A-Z)</SelectItem>
                        <SelectItem value="total-resources">Total Resources</SelectItem>
                        <SelectItem value="orgs">Organizations</SelectItem>
                        <SelectItem value="repos">Repositories</SelectItem>
                        <SelectItem value="users">Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredAndSortedCostCenters.map((center) => {
                    const { orgs, repos, members } = getResourceCounts(center)
                    const { orgs: orgList, repos: repoList, users: userList } = getResourcesByType(center)
                    const isExpanded = expandedCenters.has(center.id)
                    
                    return (
                      <Collapsible key={center.id} open={isExpanded} onOpenChange={() => toggleCenterExpansion(center.id)}>
                        <div className="rounded-lg border bg-card">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              className="w-full justify-between p-4 h-auto hover:bg-muted/50"
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="text-left">
                                  <div className="font-medium text-lg">{center.name}</div>
                                  <div className="font-mono text-sm text-muted-foreground">{center.id}</div>
                                </div>
                                <div className="flex items-center gap-6">
                                  <div className="flex gap-4 text-sm">
                                    <span className="flex items-center gap-1">
                                      <Buildings className="h-4 w-4 text-primary" />
                                      {formatNumber(orgs)} Orgs
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <GitBranch className="h-4 w-4 text-accent" />
                                      {formatNumber(repos)} Repos
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <User className="h-4 w-4 text-foreground" />
                                      {formatNumber(members)} Members
                                    </span>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </Button>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="px-4 pb-4 space-y-4">
                              {/* Organizations */}
                              {orgList.length > 0 && (
                                <div>
                                  <h4 className="flex items-center gap-2 font-medium text-sm text-muted-foreground mb-2">
                                    <Buildings className="h-4 w-4 text-primary" />
                                    Organizations ({orgList.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {orgList.map((org, index) => (
                                      <Badge key={index} variant="outline" className="border-primary/30 text-primary">
                                        {org.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Repositories */}
                              {repoList.length > 0 && (
                                <div>
                                  <h4 className="flex items-center gap-2 font-medium text-sm text-muted-foreground mb-2">
                                    <GitBranch className="h-4 w-4 text-accent" />
                                    Repositories ({repoList.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {repoList.map((repo, index) => (
                                      <Badge key={index} variant="outline" className="border-accent/30 text-accent">
                                        {repo.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Users */}
                              {userList.length > 0 && (
                                <div>
                                  <h4 className="flex items-center gap-2 font-medium text-sm text-muted-foreground mb-2">
                                    <User className="h-4 w-4 text-foreground" />
                                    Members ({userList.length})
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {userList.map((user, index) => (
                                      <Badge key={index} variant="outline" className="border-border">
                                        {user.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Empty state */}
                              {orgList.length === 0 && repoList.length === 0 && userList.length === 0 && (
                                <div className="text-center text-muted-foreground py-4">
                                  No resources assigned to this cost center
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )
                  })}
                  
                  {filteredAndSortedCostCenters.length === 0 && jsonData.activeCostCenters.length > 0 && (
                    <div className="text-center text-muted-foreground py-8 border rounded-lg">
                      <div className="space-y-2">
                        <MagnifyingGlass className="h-8 w-8 mx-auto text-muted-foreground/50" />
                        <p>No cost centers match your current filters</p>
                        <Button variant="outline" onClick={clearFilters} className="mt-2">
                          Clear Filters
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {jsonData.activeCostCenters.length === 0 && (
                    <div className="text-center text-muted-foreground py-8 border rounded-lg">
                      No active cost centers found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sample Data Info */}
        {!jsonData && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  GitHub API Setup Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  To fetch cost center data directly from GitHub Enterprise, you'll need to create a personal access token with the appropriate permissions.
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-2">1. Create a Personal Access Token</h4>
                    <p className="text-sm text-muted-foreground">
                      Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">2. Required Permissions</h4>
                    <p className="text-sm text-muted-foreground">
                      Your token needs <code className="bg-muted px-1 rounded text-xs">manage_billing:enterprise</code> scope to access cost center data
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm mb-2">3. Find Your Enterprise Slug</h4>
                    <p className="text-sm text-muted-foreground">
                      This is the name in your enterprise URL: <code className="bg-muted px-1 rounded text-xs">https://github.com/enterprises/YOUR-ENTERPRISE-SLUG</code>
                    </p>
                  </div>
                </div>
                
                <Alert>
                  <Key className="h-4 w-4" />
                  <AlertDescription>
                    Your token and enterprise configuration are securely stored locally and never shared.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Expected JSON Format
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">Your JSON should contain cost center data exactly matching the GitHub API schema:</p>
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="text-sm text-muted-foreground overflow-x-auto">
{`{
  "costCenters": [
    {
      "id": "78b18988-0df4-4118-bda8-8167132a2256",
      "name": "Marketing Team",
      "state": "active",
      "resources": [
        {
          "type": "Org",
          "name": "marketing-org"
        },
        {
          "type": "Repo", 
          "name": "marketing-team/website"
        },
        {
          "type": "User",
          "name": "john.doe"
        }
      ]
    },
    {
      "id": "c59f5d06-6ecc-44a9-bbef-a40e398b4392",
      "name": "Legacy Support",
      "state": "deleted",
      "resources": []
    }
  ]
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
