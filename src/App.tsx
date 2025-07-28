import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Upload, FileText, Download, AlertCircle, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface CostCenter {
  id: string
  name: string
  budget?: number
  actual?: number
  variance?: number
  category?: string
  department?: string
  status?: 'active' | 'deleted'
  organizations?: number
  repositories?: number
  members?: number
  [key: string]: any
}

interface ParsedData {
  costCenters: CostCenter[]
  activeCostCenters: CostCenter[]
  deletedCostCenters: CostCenter[]
  totalBudget: number
  totalActual: number
  totalVariance: number
  summary: {
    totalActive: number
    totalDeleted: number
    totalOrganizations: number
    totalRepositories: number
    totalMembers: number
    overBudget?: number
    underBudget?: number
    onBudget?: number
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
    
    // Handle different JSON structures
    if (Array.isArray(rawData)) {
      costCenters = rawData
    } else if (rawData.costCenters && Array.isArray(rawData.costCenters)) {
      costCenters = rawData.costCenters
    } else if (rawData.data && Array.isArray(rawData.data)) {
      costCenters = rawData.data
    } else {
      throw new Error('Invalid JSON structure. Expected an array of cost centers or an object with costCenters/data property.')
    }

    // Validate and process cost centers
    const processedCenters = costCenters.map((center, index) => {
      if (!center.id && !center.name) {
        center.id = `center-${index + 1}`
      }
      if (!center.name) {
        center.name = center.id || `Cost Center ${index + 1}`
      }
      
      // Set default status to active if not provided
      if (!center.status) {
        center.status = 'active'
      }
      
      // Parse numeric fields with defaults
      if (center.budget !== undefined && typeof center.budget !== 'number') {
        center.budget = parseFloat(center.budget) || 0
      }
      if (center.actual !== undefined && typeof center.actual !== 'number') {
        center.actual = parseFloat(center.actual) || 0
      }
      if (center.budget !== undefined && center.actual !== undefined) {
        center.variance = center.actual - center.budget
      }
      
      // Parse organizational metrics
      if (center.organizations !== undefined && typeof center.organizations !== 'number') {
        center.organizations = parseInt(center.organizations) || 0
      }
      if (center.repositories !== undefined && typeof center.repositories !== 'number') {
        center.repositories = parseInt(center.repositories) || 0
      }
      if (center.members !== undefined && typeof center.members !== 'number') {
        center.members = parseInt(center.members) || 0
      }
      
      return center
    })

    // Separate active and deleted cost centers
    const activeCostCenters = processedCenters.filter(center => center.status === 'active')
    const deletedCostCenters = processedCenters.filter(center => center.status === 'deleted')

    // Calculate totals for active cost centers
    const totalBudget = activeCostCenters.reduce((sum, center) => sum + (center.budget || 0), 0)
    const totalActual = activeCostCenters.reduce((sum, center) => sum + (center.actual || 0), 0)
    const totalVariance = totalActual - totalBudget

    // Calculate organizational totals for active cost centers
    const totalOrganizations = activeCostCenters.reduce((sum, center) => sum + (center.organizations || 0), 0)
    const totalRepositories = activeCostCenters.reduce((sum, center) => sum + (center.repositories || 0), 0)
    const totalMembers = activeCostCenters.reduce((sum, center) => sum + (center.members || 0), 0)

    // Calculate budget summary statistics (only for centers with budget data)
    const centersWithBudget = activeCostCenters.filter(center => center.budget !== undefined && center.actual !== undefined)
    const overBudget = centersWithBudget.filter(center => center.variance! > 0).length
    const underBudget = centersWithBudget.filter(center => center.variance! < 0).length
    const onBudget = centersWithBudget.filter(center => center.variance === 0).length

    return {
      costCenters: processedCenters,
      activeCostCenters,
      deletedCostCenters,
      totalBudget,
      totalActual,
      totalVariance,
      summary: { 
        totalActive: activeCostCenters.length,
        totalDeleted: deletedCostCenters.length,
        totalOrganizations,
        totalRepositories,
        totalMembers,
        overBudget: centersWithBudget.length > 0 ? overBudget : undefined,
        underBudget: centersWithBudget.length > 0 ? underBudget : undefined,
        onBudget: centersWithBudget.length > 0 ? onBudget : undefined
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const getVarianceBadge = (variance: number) => {
    if (variance > 0) {
      return <Badge variant="destructive">Over Budget</Badge>
    } else if (variance < 0) {
      return <Badge variant="secondary">Under Budget</Badge>
    } else {
      return <Badge className="bg-accent text-accent-foreground">On Budget</Badge>
    }
  }

  const exportReport = () => {
    if (!jsonData) return
    
    const reportData = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalBudget: jsonData.totalBudget,
        totalActual: jsonData.totalActual,
        totalVariance: jsonData.totalVariance,
        statistics: jsonData.summary
      },
      costCenters: jsonData.costCenters
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
                      <p className="text-sm font-medium text-muted-foreground">Total Budget</p>
                      <p className="text-2xl font-bold">{formatCurrency(jsonData.totalBudget)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Actual</p>
                      <p className="text-2xl font-bold">{formatCurrency(jsonData.totalActual)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Variance</p>
                      <p className={`text-2xl font-bold ${jsonData.totalVariance > 0 ? 'text-destructive' : jsonData.totalVariance < 0 ? 'text-accent' : 'text-foreground'}`}>
                        {formatCurrency(jsonData.totalVariance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Cost Centers</p>
                      <p className="text-2xl font-bold">{jsonData.costCenters.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Cost Center Status Summary</CardTitle>
                  <CardDescription>Overview of active and deleted cost centers</CardDescription>
                </div>
                <Button onClick={exportReport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{jsonData.summary.totalActive}</div>
                    <div className="text-sm text-muted-foreground">Active Cost Centers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-muted-foreground">{jsonData.summary.totalDeleted}</div>
                    <div className="text-sm text-muted-foreground">Deleted Cost Centers</div>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Organizational Metrics (Active Centers Only)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatNumber(jsonData.summary.totalOrganizations)}</div>
                      <div className="text-sm text-muted-foreground">Total Organizations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatNumber(jsonData.summary.totalRepositories)}</div>
                      <div className="text-sm text-muted-foreground">Total Repositories</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatNumber(jsonData.summary.totalMembers)}</div>
                      <div className="text-sm text-muted-foreground">Total Members</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Cost Centers Table */}
            <Card>
              <CardHeader>
                <CardTitle>Active Cost Centers - Organizational Breakdown</CardTitle>
                <CardDescription>Detailed view of all active cost centers with organizational metrics</CardDescription>
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
                      {jsonData.activeCostCenters.map((center) => (
                        <TableRow key={center.id}>
                          <TableCell className="font-medium">{center.name}</TableCell>
                          <TableCell className="font-mono text-sm">{center.id}</TableCell>
                          <TableCell className="text-right">{formatNumber(center.organizations || 0)}</TableCell>
                          <TableCell className="text-right">{formatNumber(center.repositories || 0)}</TableCell>
                          <TableCell className="text-right">{formatNumber(center.members || 0)}</TableCell>
                        </TableRow>
                      ))}
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

            {/* Budget Performance Summary (only if budget data exists) */}
            {jsonData.summary.overBudget !== undefined && (
              <Card>
                <CardHeader>
                  <CardTitle>Budget Performance Summary</CardTitle>
                  <CardDescription>Breakdown of cost center performance against budget</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-destructive">{jsonData.summary.overBudget}</div>
                      <div className="text-sm text-muted-foreground">Over Budget</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent">{jsonData.summary.underBudget}</div>
                      <div className="text-sm text-muted-foreground">Under Budget</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{jsonData.summary.onBudget}</div>
                      <div className="text-sm text-muted-foreground">On Budget</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
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
              <p className="text-muted-foreground mb-4">Your JSON file should contain cost center data with organizational metrics:</p>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm text-muted-foreground overflow-x-auto">
{`[
  {
    "id": "CC001",
    "name": "Marketing Team",
    "organizations": 3,
    "repositories": 45,
    "members": 12,
    "status": "active"
  },
  {
    "id": "CC002", 
    "name": "Engineering Division",
    "organizations": 8,
    "repositories": 234,
    "members": 67,
    "status": "active"
  },
  {
    "id": "CC003",
    "name": "Legacy Support",
    "organizations": 1,
    "repositories": 5,
    "members": 2,
    "status": "deleted"
  }
]`}
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