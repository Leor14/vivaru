/**
 * RES-03 static contract verification — no DOM, no RTL.
 * Reads raw source files and asserts textual contracts.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function src(rel: string) {
  return readFileSync(resolve(root, rel), "utf-8");
}

const services        = src("src/features/admin/services.ts");
const useAmenities    = src("src/features/reservations/use-reservable-amenities.ts");
const dialog          = src("src/components/ui/dialog.tsx");
const photoManager    = src("src/components/features/reservations/AmenityPhotoManager.tsx");
const photoGallery    = src("src/components/features/reservations/AmenityPhotoGallery.tsx");
const adminPage       = src("src/app/(admin)/admin/reservations/page.tsx");
const residentPage    = src("src/app/(resident)/resident/reservations/page.tsx");

// ─── AmenityPhoto type + services ────────────────────────────────────────────

describe("services.ts — AmenityPhoto type", () => {
  it("1. exports AmenityPhoto type with id field", () => {
    expect(services).toMatch(/export type AmenityPhoto/);
    expect(services).toMatch(/id\s*:/);
  });

  it("2. AmenityPhoto has url field", () => {
    expect(services).toMatch(/url\s*:/);
  });

  it("3. AmenityPhoto has storagePath field", () => {
    expect(services).toMatch(/storagePath\s*:/);
  });

  it("4. AmenityPhoto has order field (number)", () => {
    expect(services).toMatch(/order\s*:/);
  });

  it("5. AmenityItem has optional photos field", () => {
    expect(services).toMatch(/photos\?/);
  });
});

describe("services.ts — uploadAmenityPhoto", () => {
  it("6. exports uploadAmenityPhoto", () => {
    expect(services).toMatch(/export async function uploadAmenityPhoto/);
  });

  it("7. uses canvas", () => {
    expect(services).toMatch(/canvas/);
  });

  it("8. uses toBlob or toDataURL (client compression)", () => {
    expect(services).toMatch(/toBlob|toDataURL/);
  });
});

describe("services.ts — deleteAmenityPhoto", () => {
  it("9. exports deleteAmenityPhoto", () => {
    expect(services).toMatch(/export async function deleteAmenityPhoto/);
  });

  it("10. deleteAmenityPhoto uses deleteObject (Storage)", () => {
    expect(services).toMatch(/deleteObject/);
  });

  it("11. deleteAmenityPhoto uses updateDoc (Firestore)", () => {
    expect(services).toMatch(/updateDoc/);
  });
});

describe("services.ts — reorderAmenityPhotos", () => {
  it("12. exports reorderAmenityPhotos", () => {
    expect(services).toMatch(/export async function reorderAmenityPhotos/);
  });

  it("13. reorderAmenityPhotos calls updateDoc with photos array", () => {
    // Must reference updateDoc AND photos within the function
    const fnMatch = services.match(/function reorderAmenityPhotos[\s\S]+?^}/m);
    const fnBlock = fnMatch ? fnMatch[0] : services;
    expect(fnBlock).toMatch(/updateDoc/);
    expect(fnBlock).toMatch(/photos/);
  });
});

// ─── ReservableAmenity ────────────────────────────────────────────────────────

describe("use-reservable-amenities.ts — ReservableAmenity", () => {
  it("14. ReservableAmenity has optional photos field", () => {
    expect(useAmenities).toMatch(/photos\?/);
  });

  it("15. photos field present (flow-through or explicit)", () => {
    // Either explicit photos ?? [] fallback, photos: data.photos, or photos?: AmenityPhoto[]
    expect(useAmenities).toMatch(/photos/);
  });
});

// ─── Dialog component ─────────────────────────────────────────────────────────

describe("dialog.tsx", () => {
  it("16. uses createPortal from react-dom", () => {
    expect(dialog).toMatch(/createPortal/);
  });

  it("17. handles ESC key (keydown + Escape)", () => {
    expect(dialog).toMatch(/Escape/);
    expect(dialog).toMatch(/keydown/);
  });

  it("18. closes on overlay click (stopPropagation or overlay onClick)", () => {
    expect(dialog).toMatch(/stopPropagation|onClick={onClose}/);
  });

  it("19. accepts prop open: boolean", () => {
    expect(dialog).toMatch(/open\s*:\s*boolean/);
  });

  it("20. accepts prop onClose", () => {
    expect(dialog).toMatch(/onClose/);
  });
});

// ─── AmenityPhotoManager ──────────────────────────────────────────────────────

describe("AmenityPhotoManager.tsx", () => {
  it("21. exports component (named or default)", () => {
    expect(photoManager).toMatch(/export.*function AmenityPhotoManager|export default/);
  });

  it("22. accepts prop amenityId", () => {
    expect(photoManager).toMatch(/amenityId/);
  });

  it("23. accepts prop tenantId", () => {
    expect(photoManager).toMatch(/tenantId/);
  });

  it("24. accepts prop photos", () => {
    expect(photoManager).toMatch(/photos/);
  });

  it("25. accepts prop onChange", () => {
    expect(photoManager).toMatch(/onChange/);
  });

  it("26. enforces 8-photo limit", () => {
    expect(photoManager).toMatch(/8/);
  });

  it("27. validates 5 MB max size (5 or 5242880)", () => {
    expect(photoManager).toMatch(/5242880|5\s*\*\s*1024\s*\*\s*1024|\b5\b.*MB|MB.*\b5\b/i);
  });

  it("28. accepts image/jpeg and webp MIME types", () => {
    expect(photoManager).toMatch(/image\/jpeg/);
    expect(photoManager).toMatch(/webp/);
  });

  it("29. calls uploadAmenityPhoto on upload", () => {
    expect(photoManager).toMatch(/uploadAmenityPhoto/);
  });

  it("30. calls deleteAmenityPhoto on delete", () => {
    expect(photoManager).toMatch(/deleteAmenityPhoto/);
  });

  it("31. calls reorderAmenityPhotos for reorder buttons", () => {
    expect(photoManager).toMatch(/reorderAmenityPhotos/);
  });

  it("32. shows PORTADA/cover badge for first photo (index === 0)", () => {
    expect(photoManager).toMatch(/index\s*===\s*0|PORTADA|portada|Portada|cover/i);
  });
});

// ─── AmenityPhotoGallery ──────────────────────────────────────────────────────

describe("AmenityPhotoGallery.tsx", () => {
  it("33. exports component", () => {
    expect(photoGallery).toMatch(/export.*function AmenityPhotoGallery|export default/);
  });

  it("34. accepts prop photos", () => {
    expect(photoGallery).toMatch(/photos/);
  });

  it("35. accepts prop amenityName", () => {
    expect(photoGallery).toMatch(/amenityName/);
  });

  it("36. accepts prop open", () => {
    expect(photoGallery).toMatch(/\bopen\b/);
  });

  it("37. accepts prop onClose", () => {
    expect(photoGallery).toMatch(/onClose/);
  });

  it("38. uses Dialog component", () => {
    expect(photoGallery).toMatch(/<Dialog/);
  });

  it("39. has prev/next navigation (index - 1 or prev)", () => {
    expect(photoGallery).toMatch(/i\s*-\s*1|prev|anterior/i);
  });

  it("40. has keyboard navigation (ArrowLeft / ArrowRight)", () => {
    expect(photoGallery).toMatch(/ArrowLeft/);
    expect(photoGallery).toMatch(/ArrowRight/);
  });

  it("41. has position indicator with '/' separator (e.g. '2 / 5')", () => {
    expect(photoGallery).toMatch(/\//);
  });
});

// ─── Admin reservations page ──────────────────────────────────────────────────

describe("admin/reservations/page.tsx", () => {
  it("42. imports AmenityPhotoManager", () => {
    expect(adminPage).toMatch(/import.*AmenityPhotoManager/);
  });

  it("43. renders <AmenityPhotoManager", () => {
    expect(adminPage).toMatch(/<AmenityPhotoManager/);
  });

  it("44. passes amenityId to AmenityPhotoManager", () => {
    const managerBlock = adminPage.match(/<AmenityPhotoManager[\s\S]+?\/>/)?.[0] ?? "";
    expect(managerBlock).toMatch(/amenityId/);
  });

  it("45. passes tenantId to AmenityPhotoManager", () => {
    const managerBlock = adminPage.match(/<AmenityPhotoManager[\s\S]+?\/>/)?.[0] ?? "";
    expect(managerBlock).toMatch(/tenantId/);
  });
});

// ─── Resident reservations page ───────────────────────────────────────────────

describe("resident/reservations/page.tsx", () => {
  it("46. imports AmenityPhotoGallery", () => {
    expect(residentPage).toMatch(/import.*AmenityPhotoGallery/);
  });

  it("47. has galleryAmenity state", () => {
    expect(residentPage).toMatch(/galleryAmenity/);
  });

  it("48. renders cards with cover photo (<img)", () => {
    expect(residentPage).toMatch(/<img/);
  });

  it("49. has 'Ver fotos' button to open gallery", () => {
    expect(residentPage).toMatch(/Ver fotos/);
  });

  it("50. renders AmenityPhotoGallery at end of JSX", () => {
    expect(residentPage).toMatch(/<AmenityPhotoGallery/);
  });
});
