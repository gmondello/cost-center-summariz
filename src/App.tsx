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
  budget: number
  actual: number
  variance?: number
  category?: string
  department?: string
  [key: string]: any
}

interface ParsedData {
  costCenters: CostCenter[]
  totalBudget: number
  totalActual: number
  totalVariance: number
  summary: {
    overBudget: number
    underBudget: number
    onBudget: number
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
      if (typeof center.budget !== 'number') {
        center.budget = parseFloat(center.budget) || 0
      }
      if (typeof center.actual !== 'number') {
        center.actual = parseFloat(center.actual) || 0
      }
      center.variance = center.actual - center.budget
      return center
    })

    // Calculate totals
    const totalBudget = processedCenters.reduce((sum, center) => sum + center.budget, 0)
    const totalActual = processedCenters.reduce((sum, center) => sum + center.actual, 0)
    const totalVariance = totalActual - totalBudget

    // Calculate summary statistics
    const overBudget = processedCenters.filter(center => center.variance! > 0).length
    const underBudget = processedCenters.filter(center => center.variance! < 0).length
    const onBudget = processedCenters.filter(center => center.variance === 0).length

    return {
      costCenters: processedCenters,
      totalBudget,
      totalActual,
      totalVariance,
      summary: { overBudget, underBudget, onBudget }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
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

            {/* Performance Summary */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>Breakdown of cost center performance against budget</CardDescription>
                </div>
                <Button onClick={exportReport} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Report
                </Button>
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

            {/* Detailed Table */}
            <Card>
              <CardHeader>
                <CardTitle>Detailed Cost Center Analysis</CardTitle>
                <CardDescription>Complete breakdown of all cost centers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cost Center</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jsonData.costCenters.map((center) => (
                        <TableRow key={center.id}>
                          <TableCell className="font-medium">{center.name}</TableCell>
                          <TableCell>{center.category || center.department || 'N/A'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(center.budget)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(center.actual)}</TableCell>
                          <TableCell className={`text-right font-medium ${center.variance! > 0 ? 'text-destructive' : center.variance! < 0 ? 'text-accent' : 'text-foreground'}`}>
                            {formatCurrency(center.variance!)}
                          </TableCell>
                          <TableCell>{getVarianceBadge(center.variance!)}</TableCell>
                        </TableRow>
                      ))}
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
              <p className="text-muted-foreground mb-4">Your JSON file should contain cost center data in one of these formats:</p>
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm text-muted-foreground overflow-x-auto">
{`[
  {
    "id": "CC001",
    "name": "Marketing",
    "budget": 50000,
    "actual": 52000,
    "category": "Operations"
  },
  {
    "id": "CC002", 
    "name": "HR",
    "budget": 30000,
    "actual": 28000,
    "department": "Corporate"
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