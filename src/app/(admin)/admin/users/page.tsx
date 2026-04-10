"use client";

import { useState, useEffect, useCallback } from "react";
import { getUsers, createUser, updateUser, deleteUser } from "@/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, User as UserIcon, ChevronDown, ChevronRight } from "lucide-react";
import {
  INVENTORY_ROLE_PERMISSIONS,
  SOURCING_ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import {
  INVENTORY_MATRIX,
  SOURCING_MATRIX,
  STANDARD_ACTIONS,
  type PermissionMatrixEntity,
  type StandardAction,
} from "@/lib/permission-matrix";

type UserRole = "ADMIN" | "USER";
type InventoryRole = "VIEWER" | "EDITOR" | "MANAGER";
type SourcingRole = "VIEWER" | "EDITOR" | "MANAGER";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  inventoryRole: InventoryRole | null;
  sourcingRole: SourcingRole | null;
  permissionOverrides: string[];
  createdAt: Date;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const data = await getUsers();
      setUsers(data as UserData[]);
    } catch {
      toast.error("Failed to load users. Admin access required.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function handleDelete(user: UserData) {
    if (!confirm(`Delete user "${user.name}" (${user.email})?`)) return;
    try {
      await deleteUser(user.id);
      toast.success("User deleted");
      loadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Create users and manage their roles and permissions
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Create New User</SheetTitle>
              <SheetDescription>
                Create a new user account, assign roles, and optionally fine-tune permissions.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <UserForm
                onSubmit={async (data) => {
                  await createUser(data);
                  toast.success("User created");
                  setCreateOpen(false);
                  loadUsers();
                }}
                onCancel={() => setCreateOpen(false)}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Sheet open={editUser !== null} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit User</SheetTitle>
            <SheetDescription>
              Update the user&apos;s details, roles, and custom permission overrides.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">
            {editUser && (
              <UserForm
                key={editUser.id}
                initialData={editUser}
                onSubmit={async (data) => {
                  await updateUser(editUser.id, data);
                  toast.success("User updated");
                  setEditUser(null);
                  loadUsers();
                }}
                onCancel={() => setEditUser(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Fabric & Garmenting</TableHead>
                <TableHead>Sourcing</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {user.role === "ADMIN" ? (
                        <Shield className="mr-1 h-3 w-3" />
                      ) : (
                        <UserIcon className="mr-1 h-3 w-3" />
                      )}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === "ADMIN" ? (
                      <Badge variant="outline">Full Access</Badge>
                    ) : user.inventoryRole ? (
                      <Badge variant="outline">{user.inventoryRole}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No access</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.role === "ADMIN" ? (
                      <Badge variant="outline">Full Access</Badge>
                    ) : user.sourcingRole ? (
                      <Badge variant="outline">{user.sourcingRole}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No access</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditUser(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UserForm({
  initialData,
  onSubmit,
  onCancel,
}: {
  initialData?: UserData;
  onSubmit: (data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    inventoryRole: InventoryRole | null;
    sourcingRole: SourcingRole | null;
    permissionOverrides: string[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [email, setEmail] = useState(initialData?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(initialData?.role ?? "USER");
  const [inventoryRole, setInventoryRole] = useState<InventoryRole | null>(
    initialData?.inventoryRole ?? "EDITOR"
  );
  const [sourcingRole, setSourcingRole] = useState<SourcingRole | null>(
    initialData?.sourcingRole ?? "EDITOR"
  );
  const [overrides, setOverrides] = useState<Set<string>>(
    new Set(initialData?.permissionOverrides ?? [])
  );
  const [showOverrides, setShowOverrides] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleOverride(permission: Permission, granted: boolean) {
    const newOverrides = new Set(overrides);
    // Remove any existing override for this permission
    newOverrides.delete(`+${permission}`);
    newOverrides.delete(`-${permission}`);

    // Get the base permissions from the role
    const basePerms = new Set<string>();
    if (inventoryRole) {
      for (const p of INVENTORY_ROLE_PERMISSIONS[inventoryRole]) basePerms.add(p);
    }
    if (sourcingRole) {
      for (const p of SOURCING_ROLE_PERMISSIONS[sourcingRole]) basePerms.add(p);
    }

    const isInBase = basePerms.has(permission);

    if (granted && !isInBase) {
      newOverrides.add(`+${permission}`);
    } else if (!granted && isInBase) {
      newOverrides.add(`-${permission}`);
    }

    setOverrides(newOverrides);
  }

  function isPermissionGranted(permission: Permission): boolean {
    if (overrides.has(`+${permission}`)) return true;
    if (overrides.has(`-${permission}`)) return false;

    // Check base role
    if (inventoryRole && (INVENTORY_ROLE_PERMISSIONS[inventoryRole] as readonly string[]).includes(permission)) return true;
    if (sourcingRole && (SOURCING_ROLE_PERMISSIONS[sourcingRole] as readonly string[]).includes(permission)) return true;
    return false;
  }

  function isOverridden(permission: Permission): boolean {
    return overrides.has(`+${permission}`) || overrides.has(`-${permission}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email) return;
    if (!initialData && !password) return;

    if (role === "USER" && !inventoryRole && !sourcingRole) {
      toast.error("Grant access to at least one tool");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name,
        email,
        password,
        role,
        inventoryRole: role === "ADMIN" ? null : inventoryRole,
        sourcingRole: role === "ADMIN" ? null : sourcingRole,
        permissionOverrides: role === "ADMIN" ? [] : Array.from(overrides),
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save user"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">
          Password{initialData ? " (leave blank to keep current)" : ""}
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required={!initialData}
          placeholder={initialData ? "Unchanged" : ""}
        />
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="ADMIN">Admin (Full Access)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {role !== "ADMIN" && (
        <>
          <div className="space-y-3 rounded border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Fabric & Garmenting</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={inventoryRole !== null}
                    onChange={(e) =>
                      setInventoryRole(e.target.checked ? "EDITOR" : null)
                    }
                    className="h-4 w-4 border-input"
                  />
                  Enable
                </label>
              </div>
            </div>
            {inventoryRole && (
              <Select
                value={inventoryRole}
                onValueChange={(v) => setInventoryRole(v as InventoryRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer (read-only)</SelectItem>
                  <SelectItem value="EDITOR">Editor (create & edit)</SelectItem>
                  <SelectItem value="MANAGER">Manager (full control)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-3 rounded border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Sourcing Agent</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={sourcingRole !== null}
                    onChange={(e) =>
                      setSourcingRole(e.target.checked ? "EDITOR" : null)
                    }
                    className="h-4 w-4 border-input"
                  />
                  Enable
                </label>
              </div>
            </div>
            {sourcingRole && (
              <Select
                value={sourcingRole}
                onValueChange={(v) => setSourcingRole(v as SourcingRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Viewer (read-only)</SelectItem>
                  <SelectItem value="EDITOR">Editor (create & edit)</SelectItem>
                  <SelectItem value="MANAGER">Manager (full control)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {(inventoryRole || sourcingRole) && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowOverrides(!showOverrides)}
                className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showOverrides ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Custom Permission Overrides
                {overrides.size > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {overrides.size}
                  </Badge>
                )}
              </button>

              {showOverrides && (
                <div className="space-y-4 rounded border p-3 text-sm">
                  {inventoryRole && (
                    <PermissionMatrix
                      title="Fabric & Garmenting"
                      entities={INVENTORY_MATRIX}
                      isGranted={isPermissionGranted}
                      isOverridden={isOverridden}
                      onToggle={toggleOverride}
                    />
                  )}
                  {sourcingRole && (
                    <PermissionMatrix
                      title="Sourcing Agent"
                      entities={SOURCING_MATRIX}
                      isGranted={isPermissionGranted}
                      isOverridden={isOverridden}
                      onToggle={toggleOverride}
                    />
                  )}
                  <p className="text-[11px] text-muted-foreground italic">
                    Checked cells are granted. Cells marked with a dot are customised — they differ from the default for this role.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? "Saving..."
            : initialData
              ? "Update User"
              : "Create User"}
        </Button>
      </div>
    </form>
  );
}

function PermissionMatrix({
  title,
  entities,
  isGranted,
  isOverridden,
  onToggle,
}: {
  title: string;
  entities: PermissionMatrixEntity[];
  isGranted: (perm: Permission) => boolean;
  isOverridden: (perm: Permission) => boolean;
  onToggle: (perm: Permission, granted: boolean) => void;
}) {
  // How many entities have extras — decides whether to render the Other column
  const hasExtras = entities.some((e) => e.extras && e.extras.length > 0);

  const actionHeader = (action: StandardAction) => {
    switch (action) {
      case "view": return "View";
      case "create": return "Create";
      case "edit": return "Edit";
      case "delete": return "Delete";
    }
  };

  return (
    <div>
      <p className="mb-2 font-semibold text-xs uppercase text-muted-foreground tracking-wider">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border rounded overflow-hidden">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-1.5 font-medium w-[180px]">Module</th>
              {STANDARD_ACTIONS.map((a) => (
                <th key={a} className="text-center p-1.5 font-medium w-[60px]">
                  {actionHeader(a)}
                </th>
              ))}
              {hasExtras && (
                <th className="text-left p-1.5 font-medium">Other</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {entities.map((entity) => (
              <tr key={entity.key} className="hover:bg-muted/30">
                <td className="p-1.5 font-medium">{entity.label}</td>
                {STANDARD_ACTIONS.map((action) => {
                  const perm = entity.actions[action];
                  if (!perm) {
                    return (
                      <td key={action} className="p-1.5 text-center text-muted-foreground/50">
                        —
                      </td>
                    );
                  }
                  const granted = isGranted(perm);
                  const overridden = isOverridden(perm);
                  return (
                    <td key={action} className="p-1.5 text-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={granted}
                          onChange={(e) => onToggle(perm, e.target.checked)}
                          className="h-4 w-4 cursor-pointer border-input"
                        />
                        {overridden && (
                          <span
                            className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                            title="Customised"
                          />
                        )}
                      </label>
                    </td>
                  );
                })}
                {hasExtras && (
                  <td className="p-1.5">
                    {entity.extras && entity.extras.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {entity.extras.map((x) => {
                          const granted = isGranted(x.permission);
                          const overridden = isOverridden(x.permission);
                          return (
                            <label
                              key={x.permission}
                              className="relative inline-flex items-center gap-1 cursor-pointer px-1.5 py-0.5 rounded border bg-background hover:bg-muted/50"
                            >
                              <input
                                type="checkbox"
                                checked={granted}
                                onChange={(e) => onToggle(x.permission, e.target.checked)}
                                className="h-3 w-3 cursor-pointer border-input"
                              />
                              <span className="text-[11px]">{x.label}</span>
                              {overridden && (
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                                  title="Customised"
                                />
                              )}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
