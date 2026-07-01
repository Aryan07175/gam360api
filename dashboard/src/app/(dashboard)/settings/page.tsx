"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, Save } from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [networkCode, setNetworkCode] = useState("22846411849");
  
  const handleSave = () => {
    setLoading(true);
    setSuccess(false);
    
    // Mock save delay
    setTimeout(() => {
      setLoading(false);
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your dashboard preferences and account configurations.
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GAM Network Configuration</CardTitle>
              <CardDescription>
                Configure the connection to your Google Ad Manager 360 network.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="network">Network Code</Label>
                <Input 
                  id="network" 
                  value={networkCode} 
                  onChange={(e) => setNetworkCode(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account">Service Account Name</Label>
                <Input id="account" defaultValue="gam-api-service@project.iam.gserviceaccount.com" disabled />
                <p className="text-xs text-muted-foreground">Service account cannot be changed from the web UI.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Input id="currency" defaultValue="USD ($)" disabled />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <p className="text-sm text-muted-foreground">Changes will take effect upon next sync.</p>
              <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme Preferences</CardTitle>
              <CardDescription>
                Customize how the dashboard looks on your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <Label>Theme Selection</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Button 
                    variant={theme === 'light' ? 'default' : 'outline'} 
                    onClick={() => setTheme('light')}
                    className={theme === 'light' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                  >
                    Light
                  </Button>
                  <Button 
                    variant={theme === 'dark' ? 'default' : 'outline'} 
                    onClick={() => setTheme('dark')}
                    className={theme === 'dark' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                  >
                    Dark
                  </Button>
                  <Button 
                    variant={theme === 'system' ? 'default' : 'outline'} 
                    onClick={() => setTheme('system')}
                    className={theme === 'system' ? 'bg-indigo-600 text-white hover:bg-indigo-700' : ''}
                  >
                    System
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert Settings</CardTitle>
              <CardDescription>
                Manage how you receive automated alerts from the Anomaly Detection system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Alert Email Address</Label>
                <Input id="email" defaultValue="admin@example.com" type="email" />
              </div>
              <div className="flex items-center space-x-3 pt-4">
                <input type="checkbox" id="anomaly-alerts" defaultChecked className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                <Label htmlFor="anomaly-alerts" className="font-normal cursor-pointer">Receive email alerts for critical anomalies</Label>
              </div>
              <div className="flex items-center space-x-3">
                <input type="checkbox" id="weekly-report" defaultChecked className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600" />
                <Label htmlFor="weekly-report" className="font-normal cursor-pointer">Receive weekly summary report</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t p-6">
              <Button onClick={handleSave} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {success && (
        <div className="fixed bottom-4 right-4 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg shadow-lg flex items-center animate-in slide-in-from-bottom-5 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5 mr-2" />
          Settings saved successfully!
        </div>
      )}
    </div>
  );
}
