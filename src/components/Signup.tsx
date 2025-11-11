import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from './ui/use-toast';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Check if coupon code is valid
      if (couponCode && couponCode !== 'BCS60') {
        toast({
          title: "Invalid Coupon",
          description: "Please enter a valid coupon code.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Check if coupon has already been used on this machine
      if (couponCode === 'BCS60') {
        const machineId = await getMachineId();
        const existingCouponData = localStorage.getItem('bcs_coupon');
        
        if (existingCouponData) {
          try {
            const parsed = JSON.parse(existingCouponData);
            // Check if this machine has already used the coupon
            if (parsed.machineId === machineId) {
              const expiryDate = new Date(parsed.expiryDate);
              const currentDate = new Date();
              
              // If the coupon is still valid, don't allow reuse
              if (currentDate < expiryDate) {
                toast({
                  title: "Coupon Already Used",
                  description: "This coupon has already been used on this device.",
                  variant: "destructive",
                });
                setLoading(false);
                return;
              }
            }
          } catch (error) {
            console.error('Error parsing existing coupon data:', error);
          }
        }
      }
      
      await signUp(email, password);
      
      // If coupon code is valid, store it in localStorage
      if (couponCode === 'BCS60') {
        // Store coupon usage with machine identifier
        const machineId = await getMachineId();
        const couponData = {
          code: couponCode,
          userId: email,
          machineId: machineId,
          expiryDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days from now
        };
        localStorage.setItem('bcs_coupon', JSON.stringify(couponData));
      }
      
      toast({
        title: "Success",
        description: "Account created successfully. You are now logged in.",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create account.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate a machine identifier based on browser fingerprint
  const getMachineId = async (): Promise<string> => {
    // Create a fingerprint based on browser characteristics
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      !!navigator.cookieEnabled,
      !!navigator.onLine
    ].join('|');
    
    // Simple hash function for fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>Create a new account to get started</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="couponCode">Coupon Code (Optional)</Label>
              <Input
                id="couponCode"
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              />
              <p className="text-sm text-muted-foreground">Use code BCS60 for 60 days free</p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            <div className="text-sm text-center">
              Already have an account?{' '}
              <button
                type="button"
                className="text-blue-600 hover:underline"
                onClick={() => navigate('/login')}
              >
                Log in
              </button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Signup;