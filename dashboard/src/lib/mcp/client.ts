// Use the Vercel deployed Python API if running on Vercel, 
// otherwise use the local Python API endpoint if running local dev.
const getBaseUrl = () => {
    if (typeof window !== "undefined") {
        return process.env.NEXT_PUBLIC_API_URL || "/api";
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}/api`;
    }
    return process.env.MCP_SERVER_URL || "http://127.0.0.1:3000/api";
};

export async function callMcpTool(name: string, args: Record<string, any>) {
  const endpoint = `${getBaseUrl()}/tool`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        arguments: args,
      }),
    });
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const parsed = await response.json();
    if (parsed.status === "error") {
      throw new Error(parsed.error || "Unknown API error");
    }
    
    return parsed;
  } catch (error) {
    console.error(`Failed to call tool ${name}:`, error);
    throw error;
  }
}
