import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, FileText, Download, AlertCircle, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'

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

function App() {
  const [jsonData, setJsonData] = useState<ParsedData | null>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getResourceCounts = (center: CostCenter) => {
    const orgs = center.resources.filter(r => r.type === 'Org').length
    const repos = center.resources.filter(r => r.type === 'Repo').length
    const members = center.resources.filter(r => r.type === 'User').length
    return { orgs, repos, members }
  }

  const exportReport = () => {
    if (!jsonData) return
    
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
    
    toast.success('Report exported successfully!')
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Cost Center Summarizer</h1>
          <p className="text-muted-foreground">Upload JSON data to generate comprehensive cost center reports</p>
        </div>

        {/* Upload Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload JSON Data
            </CardTitle>
            <CardDescription>
              Select a JSON file containing cost center data to generate a summary report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileText className="w-8 h-8 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">JSON files only</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".json"
                    onChange={handleFileUpload}
                    disabled={isLoading}
                  />
                </label>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
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
                <Button onClick={exportReport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
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

            {/* Active Cost Centers Table */}
            <Card>
              <CardHeader>
                <CardTitle>Active Cost Centers - Resource Breakdown</CardTitle>
                <CardDescription>Detailed view of all active cost centers with resource counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cost Center Name</TableHead>
                        <TableHead>Cost Center ID</TableHead>
                        <TableHead className="text-right"># Organizations</TableHead>
                        <TableHead className="text-right"># Repositories</TableHead>
                        <TableHead className="text-right"># Members</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jsonData.activeCostCenters.map((center) => {
                        const { orgs, repos, members } = getResourceCounts(center)
                        return (
                          <TableRow key={center.id}>
                            <TableCell className="font-medium">{center.name}</TableCell>
                            <TableCell className="font-mono text-sm">{center.id}</TableCell>
                            <TableCell className="text-right">{formatNumber(orgs)}</TableCell>
                            <TableCell className="text-right">{formatNumber(repos)}</TableCell>
                            <TableCell className="text-right">{formatNumber(members)}</TableCell>
                          </TableRow>
                        )
                      })}
                      {jsonData.activeCostCenters.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No active cost centers found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sample Data Info */}
        {!jsonData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Expected JSON Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">Your JSON should contain cost center data exactly matching the API schema you provided:</p>
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
        )}
      </div>
    </div>
  )
}

export default App