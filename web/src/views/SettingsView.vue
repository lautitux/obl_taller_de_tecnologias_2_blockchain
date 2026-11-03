<script setup lang="ts">
import { computed, reactive, shallowRef, useTemplateRef, watchEffect } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { settingsFields, type SettingField } from '@/config/settings'
import { useSettings } from '@/composables/useSettings'
import { useSnackbar } from '@/composables/useSnackbar'

const { settings, saveSettings } = useSettings()
const { notifySuccess, notifyError } = useSnackbar()
const form = useTemplateRef('settingsForm')
const draft = reactive({ ...settings })
const formValid = shallowRef<boolean | null>(null)
const hasChanges = computed(() =>
  settingsFields.some((field) => (draft[field.key] ?? '').trim() !== settings[field.key]),
)

onBeforeRouteLeave(
  () =>
    !hasChanges.value ||
    window.confirm('Tenés cambios sin guardar. ¿Querés salir y descartar los cambios?'),
)

watchEffect((onCleanup) => {
  if (!hasChanges.value) return

  function warnBeforeUnload(event: BeforeUnloadEvent) {
    event.preventDefault()
    event.returnValue = ''
  }

  window.addEventListener('beforeunload', warnBeforeUnload)
  onCleanup(() => window.removeEventListener('beforeunload', warnBeforeUnload))
})

function canReset(field: SettingField) {
  return field.defaultValue !== undefined && draft[field.key] !== field.defaultValue
}

function reset(field: SettingField) {
  if (field.defaultValue !== undefined) {
    draft[field.key] = field.defaultValue
  }
}

async function save() {
  if (!hasChanges.value) return

  const result = await form.value?.validate()
  if (!result?.valid) return

  try {
    saveSettings(draft)
    Object.assign(draft, settings)
    notifySuccess('Configuración guardada.')
  } catch {
    notifyError('No se pudo guardar la configuración en este navegador. Intentá nuevamente.')
  }
}
</script>

<template>
  <div>
    <header class="mb-6">
      <div class="d-flex align-center ga-2 mb-4">
        <h1 class="text-h4">Configuración</h1>
        <v-btn
          v-if="hasChanges"
          type="submit"
          form="settings-form"
          icon="mdi-content-save-outline"
          variant="text"
          size="small"
          aria-label="Guardar configuración"
          title="Guardar configuración"
          :disabled="formValid !== true"
        />
      </div>
      <p>Personalizá las opciones de la aplicación.</p>
    </header>

    <v-row>
      <v-col cols="12" md="8">
        <v-form
          id="settings-form"
          ref="settingsForm"
          v-model="formValid"
          validate-on="input"
          @submit.prevent="save"
        >
          <v-text-field
            v-for="field in settingsFields"
            :key="field.key"
            v-model="draft[field.key]"
            :label="field.name"
            :hint="field.description"
            persistent-hint
            :rules="field.rules"
            autocomplete="off"
            autocapitalize="off"
            :spellcheck="false"
            class="mb-4"
          >
            <template #append-inner>
              <v-btn
                v-if="canReset(field)"
                type="button"
                icon="mdi-backup-restore"
                variant="text"
                size="small"
                :aria-label="`Restablecer ${field.name} al valor por defecto`"
                :title="`Restablecer ${field.name} al valor por defecto`"
                @click.stop="reset(field)"
              />
            </template>
          </v-text-field>
        </v-form>
      </v-col>
    </v-row>
  </div>
</template>
