import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Role } from '@/constants/roles'

const STORAGE_KEY = 'auth'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveToStorage(data: { token: string; role: Role; userId: number; nickname: string; team: string | null; departmentId: number | null }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

export const useAuthStore = defineStore('auth', () => {
  const saved = loadFromStorage()

  const accessToken = ref<string | null>(saved?.token ?? null)
  const role = ref<Role | null>(saved?.role ?? null)
  const userId = ref<number | null>(saved?.userId ?? null)
  const nickname = ref<string | null>(saved?.nickname ?? null)
  const team = ref<string | null>(saved?.team ?? null)
  const departmentId = ref<number | null>(saved?.departmentId ?? null)

  const isLoggedIn = computed(() => !!accessToken.value)

  function setAuth(token: string, userRole: Role, id: number, nick: string, userTeam: string | null = null, deptId: number | null = null) {
    accessToken.value = token
    role.value = userRole
    userId.value = id
    nickname.value = nick
    team.value = userTeam
    departmentId.value = deptId
    saveToStorage({ token, role: userRole, userId: id, nickname: nick, team: userTeam, departmentId: deptId })
  }

  function clearAuth() {
    accessToken.value = null
    role.value = null
    userId.value = null
    nickname.value = null
    team.value = null
    departmentId.value = null
    clearStorage()
  }

  return { accessToken, role, userId, nickname, team, departmentId, isLoggedIn, setAuth, clearAuth }
})
