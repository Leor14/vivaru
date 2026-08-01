"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, FilterX, KeyRound, Search, Upload, UserCheck, UserPlus, Users2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { UnitBulkImportWizard } from "@/components/features/residents/UnitBulkImportWizard";
import { ResidentBulkImportWizard } from "@/components/features/residents/ResidentBulkImportWizard";
import { Modal } from "@/components/shared/modal";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/utils/use-debounce";
import { useAuth } from "@/features/auth/auth-context";
import { useGuidedAction } from "@/features/onboarding/guided-action";
import { provisionResidentTemporaryAccessCallable } from "@/lib/firebase/callables";
import {
  personSchema,
  primaryHolderSchema,
  unitSchema,
  type PersonInput,
  type PrimaryHolderInput,
  type UnitInput,
} from "@/features/admin/schemas";
import {
  bulkCreateUnits,
  bulkCreatePeople,
  createPerson,
  createUnit,
  deletePerson,
  deleteUnit,
  saveAgrupaciones,
  seedTenantOperationalData,
  updatePerson,
  updateUnit,
  watchPeople,
  watchTenantSettings,
  watchUnits,
  type PersonItem,
  type UnitItem,
} from "@/features/admin/services";
import { DEFAULT_TOWER, distinctTowers, normalizeTower } from "@/utils/tower";
import { DuplicateUnitsPanel } from "@/components/features/admin/residents/DuplicateUnitsPanel";

export default function AdminResidentsPage() {
  const { user } = useAuth();
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [unitsLoadError, setUnitsLoadError] = useState<string | null>(null);
  const [peopleLoadError, setPeopleLoadError] = useState<string | null>(null);
  const [unitRoleFilter, setUnitRoleFilter] = useState<"all" | PersonItem["occupancyType"]>("all");
  const [unitIdFilter, setUnitIdFilter] = useState<string>("all");
  const [unitStatusFilter, setUnitStatusFilter] = useState<"all" | UnitItem["status"]>("all");
  const [peopleSearch, setPeopleSearch] = useState("");
  const debouncedPeopleSearch = useDebounce(peopleSearch.trim(), 200);

  // ── Unit table filters ──────────────────────────────────────────────────────
  const [unitSearch, setUnitSearch] = useState("");
  const debouncedUnitSearch = useDebounce(unitSearch.trim(), 200);
  const [unitGroupFilter, setUnitGroupFilter] = useState("all");
  const [unitTypeTableFilter, setUnitTypeTableFilter] = useState<"all" | UnitItem["type"]>("all");
  const [unitStatusTableFilter, setUnitStatusTableFilter] = useState<"all" | UnitItem["status"]>("all");
  const [unitNoPersonFilter, setUnitNoPersonFilter] = useState(false);

  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [residentImportOpen, setResidentImportOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonItem | null>(null);
  const [savingUnit, setSavingUnit] = useState(false);
  const [savingPerson, setSavingPerson] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [sendingResetTo, setSendingResetTo] = useState<string | null>(null);
  const [pendingUnitDeletion, setPendingUnitDeletion] = useState<UnitItem | null>(null);
  const [pendingPersonDeletion, setPendingPersonDeletion] = useState<PersonItem | null>(null);
  const [deletingUnit, setDeletingUnit] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState(false);
  const [unitExempt, setUnitExempt] = useState(false);
  /** Lista canónica de agrupaciones del tenant (tenantSettings.agrupaciones). */
  const [tenantAgrupaciones, setTenantAgrupaciones] = useState<string[] | null>(null);
  /** true cuando el usuario elige "+ Nueva agrupación…" en el modal de unidad. */
  const [customTower, setCustomTower] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<
    Array<{
      id: string;
      fullName: string;
      email: string;
      phone: string;
      documentNumber: string;
      occupancyType: PersonItem["occupancyType"];
      status: PersonItem["status"];
    }>
  >([]);

  const unitForm = useForm<UnitInput>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      displayName: "",
      tower: "",
      type: "apartment",
      status: "active",
    },
  });

  const personForm = useForm<PersonInput>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      documentNumber: "",
      roleType: "owner_occupant",
      occupancyType: "owner_occupant",
      unitId: "",
      tower: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!user?.tenantId) {
      setLoadingUnits(false);
      setLoadingPeople(false);
      return;
    }

    const unsubUnits = watchUnits(
      user.tenantId,
      (items) => {
        setUnits(items);
        setUnitsLoadError(null);
        setLoadingUnits(false);
      },
      (message) => {
        setUnitsLoadError(message);
        toast.error(message);
        setLoadingUnits(false);
      },
    );

    const unsubPeople = watchPeople(
      user.tenantId,
      (items) => {
        setPeople(items);
        setPeopleLoadError(null);
        setLoadingPeople(false);
      },
      (message) => {
        setPeopleLoadError(message);
        toast.error(message);
        setLoadingPeople(false);
      },
    );

    const unsubSettings = watchTenantSettings(
      user.tenantId,
      (item) => setTenantAgrupaciones(item?.agrupaciones ?? null),
      () => {},
    );

    return () => {
      unsubUnits();
      unsubPeople();
      unsubSettings();
    };
  }, [user?.tenantId]);

  const filteredPeople = useMemo(() => {
    const query = debouncedPeopleSearch.toLowerCase();
    return people.filter((person) => {
      const roleOk = unitRoleFilter === "all" ? true : person.occupancyType === unitRoleFilter;
      const unitOk = unitIdFilter === "all" ? true : person.unitId === unitIdFilter;
      const personUnit = units.find((unit) => unit.id === person.unitId);
      const unitStatusOk = unitStatusFilter === "all" ? true : personUnit?.status === unitStatusFilter;
      const searchOk = !query
        ? true
        : person.fullName.toLowerCase().includes(query) ||
          person.email.toLowerCase().includes(query) ||
          (person.documentNumber ?? "").toLowerCase().includes(query) ||
          (person.phone ?? "").toLowerCase().includes(query);
      return roleOk && unitOk && unitStatusOk && searchOk;
    });
  }, [people, unitIdFilter, unitRoleFilter, unitStatusFilter, units, debouncedPeopleSearch]);

  const unitsById = useMemo(() => {
    return new Map(units.map((unit) => [unit.id, unit]));
  }, [units]);

  // Filtro "Agrupación": valores canónicos (T1 / torre 1 / torre1 colapsan en "Torre 1").
  const uniqueGroups = useMemo(() => distinctTowers(units.map((unit) => unit.tower)), [units]);

  /** Opciones del selector de agrupación del modal: lista canónica del tenant ∪ las
   *  presentes en unidades (para no ocultar variantes legadas hasta la migración). */
  const towerOptions = useMemo(() => {
    const merged = new Set<string>(tenantAgrupaciones ?? []);
    for (const g of uniqueGroups) merged.add(g);
    if (merged.size === 0) merged.add(DEFAULT_TOWER);
    return Array.from(merged).sort((a, b) => a.localeCompare(b, "es-CO", { numeric: true }));
  }, [tenantAgrupaciones, uniqueGroups]);

  const filteredUnits = useMemo(() => {
    const q = debouncedUnitSearch.toLowerCase();
    return units.filter((unit) => {
      if (q && !unit.displayName.toLowerCase().includes(q) && !(unit.tower ?? "").toLowerCase().includes(q)) return false;
      if (unitGroupFilter !== "all" && normalizeTower(unit.tower) !== unitGroupFilter) return false;
      if (unitTypeTableFilter !== "all" && unit.type !== unitTypeTableFilter) return false;
      if (unitStatusTableFilter !== "all" && unit.status !== unitStatusTableFilter) return false;
      if (unitNoPersonFilter) {
        const count = people.filter((p) => p.unitId === unit.id || p.unitId === unit.unitId).length;
        if (count > 0) return false;
      }
      return true;
    });
  }, [units, people, debouncedUnitSearch, unitGroupFilter, unitTypeTableFilter, unitStatusTableFilter, unitNoPersonFilter]);

  const activePeopleCount = useMemo(() => people.filter((person) => person.status === "active").length, [people]);

  const activeFiltersCount = useMemo(() => {
    return [
      unitRoleFilter !== "all",
      unitIdFilter !== "all",
      unitStatusFilter !== "all",
      debouncedPeopleSearch.length > 0,
    ].filter(Boolean).length;
  }, [unitIdFilter, unitRoleFilter, unitStatusFilter, debouncedPeopleSearch]);

  const hasActiveFilters = activeFiltersCount > 0;

  const occupancyLabels: Record<PersonItem["occupancyType"], string> = {
    owner_occupant: "Propietario ocupante",
    tenant: "Arrendatario",
    investor: "Inversionista",
    other: "Otro",
  };

  const primaryHolderFieldOrder: Array<keyof PrimaryHolderInput> = [
    "fullName",
    "email",
    "phone",
    "documentNumber",
    "occupancyType",
  ];

  function debugResidentUnit(label: string, payload: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[admin-residents] ${label}`, payload);
    }
  }

  function focusPrimaryField(field: keyof PrimaryHolderInput) {
    const element = document.querySelector<HTMLElement>(`[name="${field}"]`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus();
  }

  function validatePrimaryHolderBlock() {
    const rawValues = personForm.getValues();
    const candidate: PrimaryHolderInput = {
      fullName: rawValues.fullName.trim(),
      email: rawValues.email.trim().toLowerCase(),
      phone: rawValues.phone.trim(),
      documentNumber: (rawValues.documentNumber ?? "").trim(),
      occupancyType: rawValues.occupancyType,
    };

    debugResidentUnit("primary-holder-before-validation", candidate);

    primaryHolderFieldOrder.forEach((field) => personForm.clearErrors(field));

    const parsed = primaryHolderSchema.safeParse(candidate);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof PrimaryHolderInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && primaryHolderFieldOrder.includes(field as keyof PrimaryHolderInput)) {
          const typedField = field as keyof PrimaryHolderInput;
          if (!fieldErrors[typedField]) {
            fieldErrors[typedField] = issue.message;
          }
        }
      }

      primaryHolderFieldOrder.forEach((field) => {
        const message = fieldErrors[field];
        if (message) {
          personForm.setError(field, { type: "manual", message });
        }
      });

      const firstInvalidField = primaryHolderFieldOrder.find((field) => Boolean(fieldErrors[field]));
      debugResidentUnit("primary-holder-validation-failed", {
        functionName: "validatePrimaryHolderBlock",
        invalidField: firstInvalidField,
        errors: fieldErrors,
      });

      if (firstInvalidField) {
        focusPrimaryField(firstInvalidField);
      }

      return null;
    }

    debugResidentUnit("primary-holder-validation-ok", parsed.data);
    return parsed.data;
  }

  const unitTypeLabels: Record<string, string> = {
    apartment: "Apartamento",
    apartamento: "Apartamento",
    house: "Casa",
    casa: "Casa",
    office: "Oficina",
    oficina: "Oficina",
    parking: "Parqueadero",
    parqueadero: "Parqueadero",
    storage: "Bodega",
    bodega: "Bodega",
    commercial: "Local comercial",
    local: "Local comercial",
  };

  function formatUnitType(value: string | undefined | null): string {
    if (!value) return "-";
    const key = value.trim().toLowerCase();
    if (unitTypeLabels[key]) return unitTypeLabels[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function formatTowerLabel(value: string | undefined | null): string {
    return normalizeTower(value) || "-";
  }

  const unitColumns: DataTableColumn<UnitItem>[] = [
    {
      key: "displayName",
      header: "Unidad",
      className: "min-w-[160px]",
      render: (unit) => <p className="font-medium text-[var(--slate-900)]">{unit.displayName}</p>,
    },
    {
      key: "tower",
      header: "Agrupación",
      className: "whitespace-nowrap",
      render: (unit) => formatTowerLabel(unit.tower),
    },
    {
      key: "type",
      header: "Tipo",
      className: "whitespace-nowrap",
      render: (unit) => formatUnitType(unit.type),
    },
    {
      key: "status",
      header: "Estado",
      className: "whitespace-nowrap",
      render: (unit) => <StatusBadge status={unit.status} context="unit" />,
    },
    {
      key: "people",
      header: "Personas",
      className: "whitespace-nowrap",
      render: (unit) => {
        const count = people.filter(
          (p) => p.unitId === unit.id || p.unitId === unit.unitId,
        ).length;
        return count === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Sin titular
          </span>
        ) : (
          <span className="text-sm text-[var(--slate-600)]">
            {count} persona{count !== 1 ? "s" : ""}
          </span>
        );
      },
    },
  ];

  const peopleColumns: DataTableColumn<PersonItem>[] = [
    {
      key: "person",
      header: "Persona",
      className: "min-w-[220px]",
      render: (person) => (
        <div>
          <p className="font-medium text-[var(--slate-900)]">{person.fullName}</p>
          <p className="text-xs text-[var(--slate-600)]">{person.email}</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      className: "min-w-[140px] text-[var(--slate-700)]",
      mobileHidden: true,
      render: (person) => person.phone || "-",
    },
    {
      key: "documentNumber",
      header: "Documento",
      className: "whitespace-nowrap text-[var(--slate-700)]",
      render: (person) => person.documentNumber ?? "-",
      mobileHidden: true,
    },
    {
      key: "occupancyType",
      header: "Ocupacion",
      className: "min-w-[170px] whitespace-nowrap",
      render: (person) => <Badge>{occupancyLabels[person.occupancyType]}</Badge>,
    },
    {
      key: "unit",
      header: "Unidad / Agrupación",
      className: "min-w-[160px]",
      render: (person) => {
        const linkedUnit = unitsById.get(person.unitId);
        return (
          <div>
            <p className="font-medium text-[var(--slate-900)]">{linkedUnit?.displayName ?? person.unitId}</p>
            <p className="text-xs text-[var(--slate-600)]">Agrupación {person.tower}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      className: "whitespace-nowrap",
      render: (person) => <StatusBadge status={person.status} context="unit" />,
    },
  ];

  /**
   * Enganches del recorrido guiado (ver `src/lib/onboarding/steps.ts`): la banda
   * de ayuda que aparece al llegar con `?guia=` no conoce el DOM de esta
   * pantalla, así que aquí se declara qué hace su botón.
   */
  useGuidedAction("unidades", () => openCreateUnit());
  useGuidedAction("residentes", () => {
    // Se agrega el titular a la primera unidad propia del conjunto; si aún no
    // hay ninguna, se abre el alta —que ya crea unidad y titulares juntos.
    const own = units.find((unit) => !(unit as { isExample?: boolean }).isExample);
    if (own) openAddPersonToUnit(own);
    else openCreateUnit();
  });

  function openCreateUnit() {
    setEditingUnit(null);
    setUnitExempt(false);
    setCustomTower(false);
    unitForm.reset({
      displayName: "",
      // Con una sola agrupación en la lista, se preselecciona (caso conjunto de un bloque).
      tower: towerOptions.length === 1 ? towerOptions[0] : "",
      type: "apartment",
      status: "active",
    });
    personForm.reset({
      fullName: "",
      email: "",
      phone: "",
      documentNumber: "",
      roleType: "owner_occupant",
      occupancyType: "owner_occupant",
      unitId: "",
      tower: "",
      status: "active",
    });
    setFamilyMembers([]);
    setUnitModalOpen(true);
  }

  function openEditUnit(unit: UnitItem) {
    setEditingUnit(unit);
    setUnitExempt(unit.reservationExempt ?? false);
    setCustomTower(false);
    unitForm.reset({
      displayName: unit.displayName,
      // Variantes legadas ("torre 1") se muestran ya canónicas ("Torre 1"): al
      // guardar, la unidad queda normalizada — migración progresiva por edición.
      tower: normalizeTower(unit.tower),
      type: unit.type,
      status: unit.status,
    });
    personForm.reset({
      fullName: "",
      email: "",
      phone: "",
      documentNumber: "",
      roleType: "owner_occupant",
      occupancyType: "owner_occupant",
      unitId: "",
      tower: unit.tower,
      status: "active",
    });
    setFamilyMembers([]);
    setUnitModalOpen(true);
  }

  function openEditPerson(person: PersonItem) {
    setEditingPerson(person);
    personForm.reset({
      fullName: person.fullName,
      email: person.email,
      phone: person.phone,
      documentNumber: person.documentNumber ?? "",
      roleType: person.roleType,
      occupancyType: person.occupancyType,
      unitId: person.unitId,
      tower: person.tower,
      status: person.status,
    });
    setPersonModalOpen(true);
  }

  function openAddPersonToUnit(unit: UnitItem) {
    setEditingPerson(null);
    personForm.reset({
      fullName: "",
      email: "",
      phone: "",
      documentNumber: "",
      roleType: "owner_occupant",
      occupancyType: "owner_occupant",
      unitId: unit.id,
      tower: unit.tower,
      status: "active",
    });
    setPersonModalOpen(true);
  }

  function addFamilyMember() {
    const id = `fm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFamilyMembers((prev) => [
      ...prev,
      {
        id,
        fullName: "",
        email: "",
        phone: "",
        documentNumber: "",
        occupancyType: "other",
        status: "active",
      },
    ]);
  }

  function updateFamilyMember(
    id: string,
    key: "fullName" | "email" | "phone" | "documentNumber" | "occupancyType" | "status",
    value: string,
  ) {
    setFamilyMembers((prev) => prev.map((member) => (member.id === id ? { ...member, [key]: value } : member)));
  }

  function removeFamilyMember(id: string) {
    setFamilyMembers((prev) => prev.filter((member) => member.id !== id));
  }

  function validateFamilyMembers() {
    if (familyMembers.length === 0) return true;
    for (const member of familyMembers) {
      if (!member.fullName.trim()) {
        toast.error("Cada familiar debe tener nombre completo.");
        return false;
      }
      if (!member.email.trim() || !member.email.includes("@")) {
        toast.error("Cada familiar debe tener un correo válido.");
        return false;
      }
      if (!member.phone.trim() || member.phone.trim().length < 7) {
        toast.error("Cada familiar debe tener teléfono válido.");
        return false;
      }
    }
    return true;
  }

  /** Suma la agrupación a la lista canónica del tenant si aún no está (fire-and-forget). */
  async function ensureTowerInCanonicalList(tower: string) {
    if (!user?.tenantId || !tower) return;
    const list = tenantAgrupaciones ?? [];
    if (list.includes(tower)) return;
    try {
      await saveAgrupaciones(
        user.tenantId,
        user.uid,
        [...list, tower].sort((a, b) => a.localeCompare(b, "es-CO", { numeric: true })),
      );
    } catch {
      /* no bloquear el flujo de la unidad por esto */
    }
  }

  async function handleSaveUnitFlow() {
    if (!user?.tenantId) return;

    const unitValid = await unitForm.trigger();
    if (!unitValid) {
      debugResidentUnit("unit-validation-failed", {
        functionName: "handleSaveUnitFlow",
        errors: unitForm.formState.errors,
      });
      return;
    }

    // getValues() devuelve los valores CRUDOS del form (el transform de zod solo
    // aplica vía handleSubmit) — normalizar aquí explícitamente.
    const unitValues = { ...unitForm.getValues() };
    unitValues.tower = normalizeTower(unitValues.tower) || DEFAULT_TOWER;

    if (editingUnit) {
      await handleSaveUnit(unitValues);
      void ensureTowerInCanonicalList(unitValues.tower);
      return;
    }

    const primaryHolder = validatePrimaryHolderBlock();
    if (!primaryHolder) {
      return;
    }
    if (!validateFamilyMembers()) return;

    // Evitar unidades duplicadas: mismo nombre (slug) y misma torre CANÓNICA en el
    // tenant ("T1" y "torre 1" cuentan como la misma torre).
    const newSlug = unitValues.displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newTower = normalizeTower(unitValues.tower).toLowerCase();
    const isDuplicateUnit = units.some((u) => {
      const sameTower = normalizeTower(u.tower).toLowerCase() === newTower;
      const sameName =
        (u.unitId ?? "").toLowerCase() === newSlug ||
        (u.displayName ?? "").trim().toLowerCase() === unitValues.displayName.trim().toLowerCase();
      return sameTower && sameName;
    });
    if (isDuplicateUnit) {
      toast.error("Ya existe una unidad con ese nombre en esa torre. Usa un nombre distinto o edita la existente.");
      return;
    }

    setSavingUnit(true);
    try {
      const createdUnit = await createUnit(user.tenantId, user.uid, unitValues);

      if (db && unitExempt) {
        await updateDoc(doc(db, "units", createdUnit.id), { reservationExempt: true });
      }

      const primaryPayload = {
        ...primaryHolder,
        roleType: primaryHolder.occupancyType,
        occupancyType: primaryHolder.occupancyType,
        unitId: createdUnit.id,
        tower: unitValues.tower.trim(),
        status: "active" as const,
      };

      debugResidentUnit("unit-create-submit-payload", {
        functionName: "handleSaveUnitFlow",
        unit: unitValues,
        primaryHolder: primaryPayload,
        familyMembers,
      });

      const primaryPersonId = await createPerson(user.tenantId, user.uid, {
        ...primaryPayload,
      });

      try {
        // El backend genera el enlace y envía el correo de acceso (Resend).
        await provisionResidentTemporaryAccessCallable({
          tenantId: user.tenantId,
          personId: primaryPersonId,
        });
      } catch (provisionError) {
        debugResidentUnit("provision-access-warning", {
          functionName: "handleSaveUnitFlow",
          personId: primaryPersonId,
          error: provisionError,
        });
        toast.warning("Unidad y titular creados. No se pudo configurar el acceso automáticamente — usa 'Restablecer acceso' desde la tabla de personas para reenviar el correo.");
      }

      for (const member of familyMembers) {
        await createPerson(user.tenantId, user.uid, {
          fullName: member.fullName,
          email: member.email,
          phone: member.phone,
          documentNumber: member.documentNumber,
          roleType: member.occupancyType,
          occupancyType: member.occupancyType,
          unitId: createdUnit.id,
          tower: unitValues.tower,
          status: member.status,
        });
      }

      toast.success("Unidad creada. Se envió al titular un correo para que defina su contraseña de acceso.");
      void ensureTowerInCanonicalList(unitValues.tower);
      setUnitModalOpen(false);
    } catch (error) {
      debugResidentUnit("unit-create-flow-error", {
        functionName: "handleSaveUnitFlow",
        error,
      });
      toastFirebaseError(error);
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleSaveUnit(values: UnitInput) {
    if (!user?.tenantId) return;
    setSavingUnit(true);
    try {
      if (editingUnit) {
        await updateUnit(editingUnit.id, user.uid, values);
        if (db) {
          await updateDoc(doc(db, "units", editingUnit.id), { reservationExempt: unitExempt });
        }
        toast.success("Unidad actualizada.");
      } else {
        await createUnit(user.tenantId, user.uid, values);
        toast.success("Unidad creada.");
      }
      setUnitModalOpen(false);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingUnit(false);
    }
  }

  async function handleDeleteUnit(unit: UnitItem) {
    // Bloquear borrado si la unidad aún tiene personas asociadas (evita huérfanos).
    const associated = people.filter((p) => p.unitId === unit.id || p.unitId === unit.unitId).length;
    if (associated > 0) {
      toast.error(
        `No puedes eliminar esta unidad: tiene ${associated} persona${associated === 1 ? "" : "s"} asociada${associated === 1 ? "" : "s"}. Elimina o reasigna esas personas primero.`,
      );
      return;
    }
    setPendingUnitDeletion(unit);
  }

  async function handleConfirmDeleteUnit() {
    if (!pendingUnitDeletion) return;
    const target = pendingUnitDeletion;
    setDeletingUnit(true);
    try {
      await deleteUnit(target.id);
      toast.success("Unidad eliminada.");
      setPendingUnitDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeletingUnit(false);
    }
  }

  async function handleSavePerson(values: PersonInput) {
    if (!user?.tenantId) return;
    setSavingPerson(true);
    try {
      const payload = {
        ...values,
        roleType: values.occupancyType,
        occupancyType: values.occupancyType,
      };
      if (editingPerson) {
        await updatePerson(editingPerson.id, user.uid, payload);
        toast.success("Persona actualizada.");
      } else {
        const personId = await createPerson(user.tenantId, user.uid, payload);
        await provisionResidentTemporaryAccessCallable({
          tenantId: user.tenantId,
          personId,
        });
        toast.success("Persona creada. Se le envió un correo para que defina su contraseña de acceso.");
      }
      setPersonModalOpen(false);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingPerson(false);
    }
  }

  async function handleDeletePerson(person: PersonItem) {
    setPendingPersonDeletion(person);
  }

  async function handleConfirmDeletePerson() {
    if (!pendingPersonDeletion) return;
    const target = pendingPersonDeletion;
    setDeletingPerson(true);
    try {
      await deletePerson(target.id);
      toast.success("Persona eliminada.");
      setPendingPersonDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeletingPerson(false);
    }
  }

  async function handleSeed() {
    if (!user?.tenantId) return;
    setSeeding(true);
    try {
      await seedTenantOperationalData(user.tenantId, user.uid);
      toast.success("Seed operativo aplicado para el tenant.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSeeding(false);
    }
  }

  async function handleResetTemporaryPassword(person: PersonItem) {
    if (!user?.tenantId) return;
    setSendingResetTo(person.id);
    try {
      await provisionResidentTemporaryAccessCallable({
        tenantId: user.tenantId,
        personId: person.id,
      });
      toast.success("Acceso restablecido. Se envió al residente un correo para que defina una nueva contraseña.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSendingResetTo(null);
    }
  }

  async function handleBulkImport(
    rows: Array<{ displayName: string; tower: string; type: UnitItem["type"]; status: UnitItem["status"] }>,
  ) {
    if (!user?.tenantId) return;
    const count = await bulkCreateUnits(user.tenantId, user.uid, rows);
    toast.success(`${count} unidad${count !== 1 ? "es" : ""} importada${count !== 1 ? "s" : ""} correctamente.`);
  }

  async function handleBulkImportPeople(
    rows: Array<{
      fullName: string;
      email: string;
      phone: string;
      documentNumber?: string;
      roleType: PersonItem["roleType"];
      occupancyType: PersonItem["occupancyType"];
      unitId: string;
      tower: string;
    }>,
  ) {
    if (!user?.tenantId) return;
    const count = await bulkCreatePeople(user.tenantId, user.uid, rows);
    toast.success(`${count} residente${count !== 1 ? "s" : ""} importado${count !== 1 ? "s" : ""} correctamente.`);
  }

  function clearPeopleFilters() {
    setUnitRoleFilter("all");
    setUnitIdFilter("all");
    setUnitStatusFilter("all");
    setPeopleSearch("");
  }

  function clearUnitsFilters() {
    setUnitSearch("");
    setUnitGroupFilter("all");
    setUnitTypeTableFilter("all");
    setUnitStatusTableFilter("all");
    setUnitNoPersonFilter(false);
  }

  const hasActiveUnitFilters =
    unitSearch.trim().length > 0 ||
    unitGroupFilter !== "all" ||
    unitTypeTableFilter !== "all" ||
    unitStatusTableFilter !== "all" ||
    unitNoPersonFilter;

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle help="El directorio vivo del conjunto. Mantenerlo actualizado es la base de todos los demás módulos: desde el cobro hasta la comunicación. Aquí defines quién vive en cada unidad, en qué calidad y con qué nivel de acceso.">Residentes, propietarios, inquilinos y unidades</CardTitle>
            <CardDescription className="mt-1">
              Gestión operativa de personas por rol y asociación a unidades del edificio.
            </CardDescription>
            {unitsLoadError || peopleLoadError ? (
              <p className="mt-2 rounded-xl border border-[var(--amber-300)] bg-[var(--amber-50)] px-3 py-2 text-xs text-[var(--amber-900)]">
                {unitsLoadError ?? peopleLoadError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {process.env.NODE_ENV === "development" && (
              <Button variant="outline" onClick={() => void handleSeed()} disabled={seeding}>
                {seeding ? "Sembrando..." : "Cargar seed"}
              </Button>
            )}
            <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Cargar unidades (CSV)
            </Button>
            <Button variant="outline" onClick={() => setResidentImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Cargar residentes (CSV)
            </Button>
            <Button variant="outline" onClick={openCreateUnit}>Crear unidad</Button>
          </div>
        </div>
      </Card>

      <DuplicateUnitsPanel tenantId={user?.tenantId} units={units} people={people} />

      <Card>
        <CardTitle help="El inventario de apartamentos, locales o casas del conjunto. Cada unidad es el punto de anclaje para cobros, residentes, reservas y PQRS. Mantén este listado preciso y todo lo demás fluye con consistencia.">Unidades</CardTitle>

        {/* ── Unit filters ─────────────────────────────────────────────────── */}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--slate-500)]" aria-hidden="true" />
            <input
              type="text"
              placeholder="Buscar unidad…"
              value={unitSearch}
              onChange={(e) => setUnitSearch(e.target.value)}
              autoComplete="off"
              className="h-9 w-full rounded-xl border border-[var(--slate-300)] bg-white pl-9 pr-8 text-sm focus:border-[var(--brand-700)] focus:outline-none"
              aria-label="Buscar unidad"
            />
            {unitSearch ? (
              <button
                type="button"
                onClick={() => setUnitSearch("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[var(--slate-400)] hover:text-[var(--slate-700)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Agrupación */}
          <select
            className="h-9 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
            value={unitGroupFilter}
            onChange={(e) => setUnitGroupFilter(e.target.value)}
            aria-label="Filtrar por agrupación"
          >
            <option value="all">Agrupación: todas</option>
            {uniqueGroups.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Tipo */}
          <select
            className="h-9 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
            value={unitTypeTableFilter}
            onChange={(e) => setUnitTypeTableFilter(e.target.value as "all" | UnitItem["type"])}
            aria-label="Filtrar por tipo"
          >
            <option value="all">Tipo: todos</option>
            <option value="apartment">Apartamento</option>
            <option value="house">Casa</option>
            <option value="office">Oficina</option>
            <option value="other">Otro</option>
          </select>

          {/* Estado */}
          <select
            className="h-9 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
            value={unitStatusTableFilter}
            onChange={(e) => setUnitStatusTableFilter(e.target.value as "all" | UnitItem["status"])}
            aria-label="Filtrar por estado"
          >
            <option value="all">Estado: todos</option>
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>

          {/* Sin titular toggle */}
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-700)] hover:bg-[var(--slate-50)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--slate-300)] accent-[var(--brand-700)]"
              checked={unitNoPersonFilter}
              onChange={(e) => setUnitNoPersonFilter(e.target.checked)}
            />
            Sin titular
          </label>

          {/* Clear */}
          {hasActiveUnitFilters ? (
            <button
              type="button"
              onClick={clearUnitsFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-600)] hover:bg-[var(--slate-50)]"
              aria-label="Limpiar filtros de unidades"
            >
              <FilterX className="h-4 w-4" />
              Limpiar
            </button>
          ) : null}
        </div>

        <div className="mt-2">
          <DataTable
            columns={unitColumns}
            rows={filteredUnits}
            getRowKey={(unit) => unit.id}
            loading={loadingUnits}
            loadingText="Cargando unidades..."
            emptyText="Sin unidades. Crea una o aplica seed."
            tableMinWidthClassName="min-w-[640px] sm:min-w-[680px]"
            renderMobileRow={(unit) => {
              const count = people.filter(
                (p) => p.unitId === unit.id || p.unitId === unit.unitId,
              ).length;
              return (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-[var(--slate-900)]">{unit.displayName}</span>
                    <span className="shrink-0 text-xs text-[var(--slate-400)]">·</span>
                    <span className="truncate text-sm text-[var(--slate-600)]">{formatTowerLabel(unit.tower)}</span>
                    <StatusBadge status={unit.status} context="unit" className="ml-auto shrink-0 text-[10px]" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--slate-500)]">
                    {formatUnitType(unit.type)}
                    {" · "}
                    {count === 0 ? (
                      <span className="text-amber-600">Sin titular</span>
                    ) : (
                      `${count} persona${count !== 1 ? "s" : ""}`
                    )}
                  </p>
                </div>
              );
            }}
            renderActions={(unit) => (
              <div className="flex justify-end">
                <RowActionsMenu
                  ariaLabel={`Acciones para unidad ${unit.displayName}`}
                  onView={() => openEditUnit(unit)}
                  onEdit={() => openEditUnit(unit)}
                  onDelete={() => void handleDeleteUnit(unit)}
                  extraItems={[
                    {
                      key: "add-person",
                      label: "Agregar persona",
                      icon: <UserPlus className="h-3.5 w-3.5" />,
                      separatorBefore: true,
                      onSelect: () => openAddPersonToUnit(unit),
                    },
                  ]}
                />
              </div>
            )}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Personas asociadas</CardTitle>
              <CardDescription className="mt-1">
                Titulares y residentes vinculados a cada unidad, con acceso rápido a acciones operativas.
              </CardDescription>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-100)] px-3 py-2">
                <p className="inline-flex items-center gap-1 text-xs text-[var(--slate-600)]"><Users2 className="h-3.5 w-3.5" /> Total</p>
                <p className="text-sm font-semibold text-[var(--slate-900)]">{people.length}</p>
              </div>
              <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-100)] px-3 py-2">
                <p className="inline-flex items-center gap-1 text-xs text-[var(--slate-600)]"><UserCheck className="h-3.5 w-3.5" /> Activos</p>
                <p className="text-sm font-semibold text-[var(--slate-900)]">{activePeopleCount}</p>
              </div>
              <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-100)] px-3 py-2">
                <p className="inline-flex items-center gap-1 text-xs text-[var(--slate-600)]"><Building2 className="h-3.5 w-3.5" /> Unidades</p>
                <p className="text-sm font-semibold text-[var(--slate-900)]">{units.length}</p>
              </div>
            </div>
          </div>

          <MobileFiltersPanel
            title="Filtros de personas"
            collapsibleOnDesktop
            defaultOpen={false}
            activeFiltersCount={activeFiltersCount}
            openLabel="Mostrar filtros"
            closeLabel="Ocultar filtros"
            footer={
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--slate-600)]">{activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s) activo(s)` : "Sin filtros activos"}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="inline-flex items-center gap-1"
                  disabled={!hasActiveFilters}
                  onClick={clearPeopleFilters}
                >
                  <IconBadge tone="sand">
                    <FilterX className="h-3.5 w-3.5" />
                  </IconBadge>
                  Limpiar filtros
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <label className="block text-xs text-[var(--slate-600)]">
                Buscar persona
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--slate-500)]" aria-hidden="true" />
                  <input
                    type="text"
                    placeholder="Nombre, email o documento..."
                    value={peopleSearch}
                    onChange={(event) => setPeopleSearch(event.target.value)}
                    autoComplete="off"
                    className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white pl-9 pr-9 text-sm focus:border-[var(--brand-700)] focus:outline-none"
                    aria-label="Buscar persona por nombre, email o documento"
                  />
                  {peopleSearch ? (
                    <button
                      type="button"
                      onClick={() => setPeopleSearch("")}
                      aria-label="Limpiar busqueda"
                      className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--slate-500)] hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </label>
              <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-[var(--slate-600)]">
                Ocupacion
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={unitRoleFilter}
                  onChange={(event) => setUnitRoleFilter(event.target.value as "all" | PersonItem["occupancyType"])}
                >
                  <option value="all">Todas</option>
                  <option value="owner_occupant">Propietario ocupante</option>
                  <option value="tenant">Arrendatario</option>
                  <option value="investor">Inversionista</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="text-xs text-[var(--slate-600)]">
                Estado de unidad
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={unitStatusFilter}
                  onChange={(event) => setUnitStatusFilter(event.target.value as "all" | UnitItem["status"])}
                >
                  <option value="all">Todos</option>
                  <option value="active">Activa</option>
                  <option value="inactive">Inactiva</option>
                </select>
              </label>
              <label className="text-xs text-[var(--slate-600)]">
                Unidad
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={unitIdFilter}
                  onChange={(event) => setUnitIdFilter(event.target.value)}
                >
                  <option value="all">Todas</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.displayName}</option>
                  ))}
                </select>
              </label>
            </div>
            </div>
          </MobileFiltersPanel>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--slate-200)] bg-white p-3 sm:p-4">
          <DataTable
            columns={peopleColumns}
            rows={filteredPeople}
            getRowKey={(person) => person.id}
            loading={loadingPeople}
            loadingText="Cargando personas..."
            emptyText="No hay personas con esos filtros."
            tableMinWidthClassName="min-w-[760px] xl:min-w-[980px]"
            renderMobileRow={(person) => {
              const linkedUnit = unitsById.get(person.unitId);
              return (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-[var(--slate-900)]">{person.fullName}</span>
                    <StatusBadge status={person.status} context="unit" className="ml-auto shrink-0 text-[10px]" />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--slate-500)]">
                    {person.email}
                    {" · "}
                    {occupancyLabels[person.occupancyType]}
                    {linkedUnit ? ` · ${linkedUnit.displayName}` : ""}
                  </p>
                </div>
              );
            }}
            renderActions={(person) => (
              <div className="flex justify-end">
                <RowActionsMenu
                  ariaLabel={`Acciones para ${person.fullName}`}
                  onView={() => openEditPerson(person)}
                  onEdit={() => openEditPerson(person)}
                  onDelete={() => void handleDeletePerson(person)}
                  extraItems={[
                    {
                      key: "reset-password",
                      label: sendingResetTo === person.id ? "Enviando..." : "Reenviar acceso",
                      icon: <KeyRound className="h-3.5 w-3.5" />,
                      disabled: sendingResetTo === person.id,
                      onSelect: () => void handleResetTemporaryPassword(person),
                    },
                  ]}
                />
              </div>
            )}
          />
        </div>
      </Card>

      <Modal open={unitModalOpen} title={editingUnit ? "Editar unidad" : "Crear unidad y titulares"} onClose={() => setUnitModalOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveUnitFlow();
          }}
        >
          <Card className="p-4">
            <CardTitle className="text-base">1. Datos de la unidad</CardTitle>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre de la unidad</label>
                <Input {...unitForm.register("displayName")} placeholder="T1-101" />
                {unitForm.formState.errors.displayName ? <p className="mt-1 text-xs text-[var(--danger-700)]">{unitForm.formState.errors.displayName.message}</p> : null}
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Agrupación</label>
                {/* Selección desde la lista canónica (no texto libre): las variantes
                    T1/torre 1/torre1 fragmentaban filtros y KPIs. "+ Nueva…" permite
                    crear una agrupación nueva, que se suma a la lista del conjunto. */}
                <select
                  className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={customTower ? "__nueva__" : unitForm.watch("tower") || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__nueva__") {
                      setCustomTower(true);
                      unitForm.setValue("tower", "", { shouldValidate: false });
                    } else {
                      setCustomTower(false);
                      unitForm.setValue("tower", value, { shouldValidate: true, shouldDirty: true });
                    }
                  }}
                >
                  <option value="">Selecciona una agrupación…</option>
                  {towerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value="__nueva__">+ Nueva agrupación…</option>
                </select>
                {customTower ? (
                  <Input
                    className="mt-2"
                    {...unitForm.register("tower")}
                    placeholder="Ej: Torre 3, Bloque B, Manzana 5…"
                    autoFocus
                  />
                ) : null}
                {unitForm.formState.errors.tower ? <p className="mt-1 text-xs text-[var(--danger-700)]">{unitForm.formState.errors.tower.message}</p> : null}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-[var(--slate-700)]">
                Tipo
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...unitForm.register("type")}>
                  <option value="apartment">Apartamento</option>
                  <option value="house">Casa</option>
                  <option value="office">Oficina</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label className="text-sm text-[var(--slate-700)]">
                Estado
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...unitForm.register("status")}>
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </label>
            </div>
            <div className="mt-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[var(--slate-300)] accent-[var(--brand-700)]"
                  checked={unitExempt}
                  onChange={(e) => setUnitExempt(e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium text-[var(--slate-900)]">Exenta de bloqueo por adeudo</p>
                  <p className="mt-0.5 text-xs text-[var(--slate-600)]">Esta unidad puede hacer reservas aunque tenga saldo vencido (convenio de pago u otras excepciones).</p>
                </div>
              </label>
            </div>
          </Card>

          {!editingUnit ? (
            <>
              <Card className="p-4">
                <CardTitle className="text-base">2. Titular principal</CardTitle>
                <div className="mt-3">
                  <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre completo</label>
                  <Input {...personForm.register("fullName")} error={personForm.formState.errors.fullName?.message} />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-[var(--slate-700)]">Correo</label>
                    <Input {...personForm.register("email")} error={personForm.formState.errors.email?.message} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-[var(--slate-700)]">Teléfono</label>
                    <Input {...personForm.register("phone")} error={personForm.formState.errors.phone?.message} />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-[var(--slate-700)]">Documento</label>
                    <Input {...personForm.register("documentNumber")} error={personForm.formState.errors.documentNumber?.message} />
                  </div>
                  <label className="text-sm text-[var(--slate-700)]">
                    Tipo de ocupacion
                    <select
                      className={`mt-1 h-10 w-full rounded-xl border bg-white px-3 text-sm ${
                        personForm.formState.errors.occupancyType
                          ? "border-[var(--danger-500)] focus:ring-2 focus:ring-[var(--danger-200)]"
                          : "border-[var(--slate-300)]"
                      }`}
                      {...personForm.register("occupancyType")}
                      onChange={(event) => {
                        const value = event.target.value as PersonItem["occupancyType"];
                        personForm.setValue("occupancyType", value);
                        personForm.setValue("roleType", value);
                      }}
                    >
                      <option value="owner_occupant">Propietario ocupante</option>
                      <option value="tenant">Arrendatario</option>
                      <option value="investor">Inversionista</option>
                      <option value="other">Otro</option>
                    </select>
                    {personForm.formState.errors.occupancyType ? (
                      <p className="mt-1 text-xs text-[var(--danger-700)]">{personForm.formState.errors.occupancyType.message}</p>
                    ) : null}
                  </label>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">3. Nucleo familiar (opcional)</CardTitle>
                  <Button type="button" variant="outline" size="sm" onClick={addFamilyMember}>Agregar familiar</Button>
                </div>
                {familyMembers.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--slate-600)]">No hay familiares agregados.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {familyMembers.map((member, index) => (
                      <div key={member.id} className="rounded-xl border border-[var(--slate-200)] p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-semibold text-[var(--slate-900)]">Familiar {index + 1}</p>
                          <Button type="button" size="sm" variant="outline" onClick={() => removeFamilyMember(member.id)}>Quitar</Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            placeholder="Nombre completo"
                            value={member.fullName}
                            onChange={(event) => updateFamilyMember(member.id, "fullName", event.target.value)}
                          />
                          <Input
                            placeholder="Correo"
                            value={member.email}
                            onChange={(event) => updateFamilyMember(member.id, "email", event.target.value)}
                          />
                          <Input
                            placeholder="Teléfono"
                            value={member.phone}
                            onChange={(event) => updateFamilyMember(member.id, "phone", event.target.value)}
                          />
                          <Input
                            placeholder="Documento"
                            value={member.documentNumber}
                            onChange={(event) => updateFamilyMember(member.id, "documentNumber", event.target.value)}
                          />
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <select
                            className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                            value={member.occupancyType}
                            onChange={(event) => updateFamilyMember(member.id, "occupancyType", event.target.value)}
                          >
                            <option value="owner_occupant">Propietario ocupante</option>
                            <option value="tenant">Arrendatario</option>
                            <option value="investor">Inversionista</option>
                            <option value="other">Otro</option>
                          </select>
                          <select
                            className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                            value={member.status}
                            onChange={(event) => updateFamilyMember(member.id, "status", event.target.value)}
                          >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-4">
                <CardTitle className="text-base">4. Credenciales y acceso</CardTitle>
                <CardDescription className="mt-2">
                  Al guardar, el titular queda creado y desde la tabla de personas podrás usar la acción de restablecimiento de clave por correo.
                </CardDescription>
              </Card>
            </>
          ) : null}

          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setUnitModalOpen(false)}>Cancelar</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingUnit}>{savingUnit ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={personModalOpen} title={editingPerson ? "Editar persona" : "Crear persona"} onClose={() => setPersonModalOpen(false)}>
        <form className="space-y-3" onSubmit={personForm.handleSubmit((values) => void handleSavePerson(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre completo</label>
            <Input {...personForm.register("fullName")} />
            {personForm.formState.errors.fullName ? <p className="mt-1 text-xs text-[var(--danger-700)]">{personForm.formState.errors.fullName.message}</p> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Correo</label>
              <Input {...personForm.register("email")} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Telefono</label>
              <Input {...personForm.register("phone")} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo de ocupacion
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                {...personForm.register("occupancyType")}
                onChange={(event) => {
                  const value = event.target.value as PersonItem["occupancyType"];
                  personForm.setValue("occupancyType", value);
                  personForm.setValue("roleType", value);
                }}
              >
                <option value="owner_occupant">Propietario ocupante</option>
                <option value="tenant">Inquilino</option>
                <option value="investor">Inversionista</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Unidad
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                {...personForm.register("unitId")}
                onChange={(event) => {
                  const selected = units.find((item) => item.id === event.target.value);
                  if (selected) {
                    personForm.setValue("tower", selected.tower);
                  }
                  personForm.setValue("unitId", event.target.value);
                }}
              >
                <option value="">Selecciona</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.displayName}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Documento</label>
              <Input {...personForm.register("documentNumber")} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">
                Agrupación
              </label>
              <Input
                {...personForm.register("tower")}
                readOnly
                className="cursor-default select-none bg-[var(--slate-50)] text-[var(--slate-500)] focus:border-[var(--slate-300)] focus:ring-0"
              />
              <p className="mt-1 text-xs text-[var(--slate-400)]">
                Se completa automáticamente al seleccionar la unidad.
              </p>
            </div>
          </div>
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...personForm.register("status")}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setPersonModalOpen(false)}>Cancelar</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingPerson}>{savingPerson ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={bulkImportOpen}
        title="Importar unidades desde CSV"
        onClose={() => setBulkImportOpen(false)}
      >
        <UnitBulkImportWizard
          existingUnits={units}
          onImport={handleBulkImport}
          onClose={() => setBulkImportOpen(false)}
        />
      </Modal>

      <Modal
        open={residentImportOpen}
        title="Importar residentes desde CSV"
        onClose={() => setResidentImportOpen(false)}
      >
        <ResidentBulkImportWizard
          existingUnits={units}
          existingPeople={people}
          onImport={handleBulkImportPeople}
          onClose={() => setResidentImportOpen(false)}
        />
      </Modal>

      <ConfirmDeleteDialog
        open={Boolean(pendingUnitDeletion)}
        name={pendingUnitDeletion?.displayName ?? ""}
        description={
          pendingUnitDeletion
            ? `Se eliminará la unidad ${pendingUnitDeletion.displayName} (Agrupación ${pendingUnitDeletion.tower}). No se puede deshacer.`
            : null
        }
        loading={deletingUnit}
        onCancel={() => (deletingUnit ? undefined : setPendingUnitDeletion(null))}
        onConfirm={() => void handleConfirmDeleteUnit()}
      />

      <ConfirmDeleteDialog
        open={Boolean(pendingPersonDeletion)}
        name={pendingPersonDeletion?.fullName ?? ""}
        description={
          pendingPersonDeletion
            ? `Se eliminará el registro de ${pendingPersonDeletion.fullName} y se perderá su acceso a la plataforma. No se puede deshacer.`
            : null
        }
        loading={deletingPerson}
        onCancel={() => (deletingPerson ? undefined : setPendingPersonDeletion(null))}
        onConfirm={() => void handleConfirmDeletePerson()}
      />
    </section>
  );
}
