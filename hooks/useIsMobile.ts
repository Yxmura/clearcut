"use client"

import { useState, useEffect } from "react"

interface UseIsMobileReturn {
  isMobile: boolean
  isLoading: boolean
}

export const useIsMobile = (): UseIsMobileReturn => {
  const [isMobile, setIsMobile] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkIsMobile = () => {
      const mediaQuery = window.matchMedia("(max-width: 768px)")
      const userAgent = navigator.userAgent.toLowerCase()
      const mobileKeywords = [
        "android", "webos", "iphone", "ipad", "ipod",
        "blackberry", "windows phone", "mobile",
      ]
      const isMobileUA = mobileKeywords.some(kw => userAgent.includes(kw))
      const isMobileDevice = mediaQuery.matches || (isMobileUA && window.innerWidth <= 768)
      setIsMobile(isMobileDevice)
      setIsLoading(false)
    }

    checkIsMobile()

    const mediaQuery = window.matchMedia("(max-width: 768px)")
    const handleChange = () => checkIsMobile()
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange)
    } else {
      mediaQuery.addListener(handleChange)
    }
    window.addEventListener("resize", checkIsMobile)

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange)
      } else {
        mediaQuery.removeListener(handleChange)
      }
      window.removeEventListener("resize", checkIsMobile)
    }
  }, [])

  return { isMobile, isLoading }
}
