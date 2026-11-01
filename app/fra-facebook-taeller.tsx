"use client";

import { useEffect } from "react";
import { besoegKald } from "@/lib/facebook-kilde";

/**
 * Tæller anonymt et besøg via et link fra Facebook (?fra=fb-el). Ingen cookies, intet om personen.
 * Kun mærket sendes; resten af adressen (fx fbclid) sendes ikke.
 */
export function FraFacebookTaeller() {
  useEffect(() => {
    const kald = besoegKald(window.location.search);
    if (!kald) return;
    fetch(kald.sti, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kald.body),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
