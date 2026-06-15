import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, LogOut, User as UserIcon, Settings, KeyRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function WorkspaceHeaderExtras() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null; avatar_url: string | null }>({ full_name: null, email: null, avatar_url: null });
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuper, setIsSuper] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: sa }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name,email,avatar_url").eq("id", user.id).maybeSingle(),
        supabase.rpc("is_super_admin", { _user_id: user.id }),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      if (p) setProfile(p as any);
      setIsSuper(!!sa);
      setIsAdmin(!!sa || !!roles?.some((r: any) => ["org_admin", "reseller_admin", "manager"].includes(r.role)));
    })();
  }, [user]);

  const initials = (profile.full_name || profile.email || user?.email || "U")
    .split(/\s|@/)
    .filter(Boolean)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
          <Link to={isSuper ? "/platform" : "/customer"}>
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Admin Portal</span>
          </Link>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40">
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="text-sm font-medium truncate">{profile.full_name || profile.email}</span>
            {isSuper && <Badge variant="outline" className="w-fit text-[10px]">Super Admin</Badge>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/my/profile")}><UserIcon className="h-4 w-4 mr-2" />Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/my/settings")}><Settings className="h-4 w-4 mr-2" />Settings</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/my/profile#password")}><KeyRound className="h-4 w-4 mr-2" />Change password</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut?.()} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4 mr-2" />Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
