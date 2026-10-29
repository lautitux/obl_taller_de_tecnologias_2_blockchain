# Obligatorio — Taller de Tecnologías 2

Monorepo con npm workspaces: contratos de vesting en Solidity con Hardhat y una aplicación web con Vue y Vite.

## Estructura

```text
blockchain/
  contracts/          Contratos y tests unitarios de Solidity (*.t.sol)
  hardhat.config.ts   Configuración de compilación y redes
  foundry.toml        Configuración de Forge para lint
  tsconfig.json      TypeScript de Hardhat, separado del frontend
web/
  src/               Aplicación Vue
  public/            Archivos estáticos
  vite.config.ts     Configuración del frontend
.github/
  scripts/           Validación de cobertura
  workflows/         CI de ambos workspaces
package.json         Comandos comunes y configuración de workspaces
package-lock.json    Lockfile único
```

Los tests de integración TypeScript se agregarán en `blockchain/test/`, los módulos de despliegue en `blockchain/ignition/` y los scripts de Hardhat en `blockchain/scripts/` cuando sean necesarios.

## Requisitos e instalación

- Node.js `^22.18.0 || >=24.12.0`; CI usa Node.js 24.
- npm 11 o superior con soporte de workspaces.
- Forge para ejecutar el lint de Solidity; CI usa Foundry v1.8.6.

Desde la raíz del repositorio:

```sh
npm ci
```

No hace falta instalar dependencias dentro de cada workspace. La configuración `.npmrc` conserva deshabilitados los scripts de instalación de dependencias.

## Comandos

Todos estos comandos se ejecutan desde la raíz. La convención es `acción:ámbito`: por ejemplo, `build:web` y `build:blockchain`. Los comandos sin ámbito coordinan las tareas correspondientes.

| Comando                                    | Función                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| `npm run dev` / `npm run dev:web`          | Inicia Vite                                                                 |
| `npm run dev:blockchain`                   | Inicia el nodo local de Hardhat                                             |
| `npm run build`                            | Compila contratos y construye la web                                        |
| `npm run build:blockchain`                 | Compila contratos                                                           |
| `npm run build:web`                        | Comprueba los tipos y construye la web                                      |
| `npm run typecheck`                        | Comprueba los tipos de ambos workspaces                                     |
| `npm run typecheck:blockchain`             | Compila contratos y comprueba los tipos de Hardhat                          |
| `npm run typecheck:web`                    | Comprueba los tipos de Vue y su configuración                               |
| `npm run test` / `npm run test:blockchain` | Ejecuta todos los tests de Hardhat                                          |
| `npm run test:solidity`                    | Ejecuta los tests de Solidity                                               |
| `npm run test:typescript`                  | Ejecuta los tests de integración TypeScript                                 |
| `npm run test:coverage`                    | Genera cobertura Solidity y exige 100% de líneas por contrato de producción |
| `npm run coverage:clean`                   | Limpia el reporte generado en `blockchain/coverage/`                        |
| `npm run coverage:check`                   | Valida el reporte existente contra una compilación sin instrumentación      |
| `npm run lint`                             | Comprueba Solidity y web sin modificar archivos                             |
| `npm run lint:blockchain`                  | Ejecuta Forge lint; los avisos bloquean                                     |
| `npm run lint:web`                         | Ejecuta Oxlint y ESLint                                                     |
| `npm run lint:fix:web`                     | Aplica correcciones automáticas de Oxlint y ESLint                          |
| `npm run lint:advisory:blockchain`         | Muestra hallazgos informativos y de gas                                     |
| `npm run format`                           | Formatea el repositorio con Prettier                                        |
| `npm run format:check`                     | Comprueba el formato sin modificar archivos                                 |
| `npm run preview:web`                      | Sirve el build de producción de la web localmente                           |

También se puede ejecutar un comando directamente en su workspace:

```sh
npm run build --workspace blockchain
npm run dev --workspace web
```

Para pasar argumentos a una tarea desde la raíz:

```sh
npm run test:solidity -- --coverage
npm run dev:web -- --host 127.0.0.1
```

La web todavía es la plantilla inicial y no tiene tests ni conexión con los contratos. `npm run test` ejecuta únicamente los tests de blockchain.

## Redes e integración con la web

Hardhat tiene redes simuladas y configuración de Sepolia. Para usar Sepolia, definir `SEPOLIA_RPC_URL` y `SEPOLIA_PRIVATE_KEY` en el entorno del proceso de Hardhat. No exponer la clave privada mediante variables `VITE_*`.

Todavía no hay un módulo de despliegue. Al implementar la integración, exportar el ABI desde la compilación y registrar las direcciones por red desde el despliegue. El frontend debe consumir esos datos públicos sin importar la configuración de Hardhat ni copiar ABIs a mano.

## CI

Los pull requests a `develop` y `main` comprueban formato, compilación y tipos de ambos workspaces, lint de Solidity y web, tests y cobertura Solidity. Los reportes de cobertura se generan en `blockchain/coverage/`.
