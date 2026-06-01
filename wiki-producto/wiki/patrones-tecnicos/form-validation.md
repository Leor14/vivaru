---
tags: [patron, formularios, validacion, zod]
tipo: tecnica
fuentes: ["PRODUCT.md", "DESIGN.md"]
fecha_creacion: 2026-05-20
fecha_actualizacion: 2026-05-20
---

# Validación de Formularios

Patrón estándar de formularios en Vivaru usando Zod para esquemas y React Hook Form para el manejo de estado. La combinación reduce re-renders, provee tipado end-to-end y simplifica la integración con [[firebase-firestore|Firebase]].

## Stack de validación

- **Zod**: define el esquema de validación con tipos TypeScript inferidos
- **React Hook Form**: maneja el estado del formulario con mínimo re-render
- **zodResolver**: puente entre ambas librerías

```tsx
const schema = z.object({
  unitLabel: z.string().min(1, "La unidad es requerida"),
  amount: z.number().positive("El monto debe ser positivo"),
})

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
})
```

## React.forwardRef obligatorio

Cualquier componente de input que se use con React Hook Form debe implementar `React.forwardRef`. Sin esto, el register de RHF no puede obtener la referencia al elemento DOM y la validación falla silenciosamente. Esta es una de las [[trampas-conocidas]].

```tsx
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("...", className)} {...props} />
  )
)
Input.displayName = "Input"
```

## Mensajes de error

Los mensajes de error siguen la convención de copy de [[product-md]]:
- Formato: "No fue posible [acción]. Intenta de nuevo."
- Nunca: "Error 500", "Undefined error", ni mensajes técnicos
- Para errores de campo: descriptivos y accionables ("El NIT debe tener 9 dígitos")

## Formularios en Drawer

Los formularios complejos (múltiples secciones, campos condicionales) viven en [[drawer-pattern|Drawers]], no en Modals. Ejemplo: crear una [[reservaciones|reservación de mudanza]] requiere verificar depósito, coordinar elevador y añadir notas — flujo de Drawer.

## Validación en Cloud Functions

Los esquemas Zod también se usan en [[firebase-firestore|Cloud Functions]] para validar el payload antes de escribir en Firestore. Esto garantiza que los datos en la base siempre respeten los tipos de [[domain-types]].

## Relaciones

- Véase también: [[stack-tecnico]], [[drawer-pattern]], [[domain-types]]
- Depende de: [[trampas-conocidas]]
- Se conecta con: [[usuarios]], [[reservaciones]], [[pqrs]], [[firebase-firestore]]

## Fuentes

- [[product-md]], [[design-md]]
