"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export interface TherapistLite { id: string; userId: string; fullName: string; color: string; specialty: string | null; sessionPrice: number | null; workDays: number[]; isActive: boolean }

export function useTherapists() {
  return useQuery({ queryKey: ["therapists"], queryFn: () => api.get<{ items: TherapistLite[] }>("/users/therapists"), staleTime: 5 * 60_000 });
}

export function usePatientLookup(q: string) {
  return useQuery({ queryKey: ["patient-lookup", q], queryFn: () => api.get<{ items: { id: string; fullName: string; fileNumber: string; phone: string; primaryTherapistId: string | null }[] }>("/patients/lookup", { q }), staleTime: 30_000 });
}
