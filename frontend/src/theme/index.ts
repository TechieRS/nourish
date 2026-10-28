import { extendTheme } from "@chakra-ui/react";
export const theme = extendTheme({
  colors: {
    brand: {
      50: "#F0F5F0",
      100: "#E6EFE8",
      200: "#C7DACC",
      300: "#A4C0AD",
      400: "#6E947C",
      500: "#557C68",
      600: "#426451",
      700: "#294D3B",
      800: "#213E30",
      900: "#192F24",
    },
    ivory: "#FAF9F6",
    ink: "#26352D",
    muted: "#606F65",
    peach: "#F7E5DA",
  },
  fonts: { heading: '"DM Sans", sans-serif', body: "Inter, sans-serif" },
  styles: {
    global: {
      body: { bg: "ivory", color: "ink" },
      "::selection": { background: "#C7DACC" },
      "*": { WebkitTapHighlightColor: "transparent" },
      ":focus-visible": { outline: "3px solid #557C68", outlineOffset: "3px" },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.01ms !important",
          transitionDuration: "0.01ms !important",
          scrollBehavior: "auto !important",
        },
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: "full",
        fontWeight: 600,
        minH: "44px",
        whiteSpace: "normal",
      },
      defaultProps: { colorScheme: "brand" },
      variants: {
        solid: {
          bg: "brand.700",
          color: "white",
          _hover: { bg: "brand.600" },
          _disabled: { opacity: 0.5 },
        },
        outline: { borderColor: "brand.200", color: "brand.700" },
        ghost: { color: "brand.700" },
        link: { color: "brand.600" },
      },
    },
    Input: {
      defaultProps: { size: "lg" },
      baseStyle: { field: { borderRadius: "xl" } },
      variants: {
        outline: {
          field: {
            bg: "white",
            borderColor: "brand.200",
            _focusVisible: {
              borderColor: "brand.500",
              boxShadow: "0 0 0 1px #557C68",
            },
          },
        },
      },
    },
    Select: {
      defaultProps: { size: "lg" },
      variants: {
        outline: {
          field: { borderRadius: "xl", bg: "white", borderColor: "brand.200" },
        },
      },
    },
    Heading: { baseStyle: { fontWeight: 600, letterSpacing: "-0.035em" } },
    Modal: { baseStyle: { dialog: { borderRadius: "2xl", mx: 3 } } },
    Tabs: { defaultProps: { colorScheme: "brand" } },
    FormLabel: { baseStyle: { fontSize: "sm", fontWeight: 600 } },
  },
});
