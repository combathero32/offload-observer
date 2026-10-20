include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-offload-observer
PKG_VERSION:=0.2.4
PKG_RELEASE:=1
PKG_LICENSE:=MIT
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-offload-observer
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Hardware-offload-aware observed usage dashboard
  DEPENDS:=+luci-base +ucode +ucode-mod-fs +ucode-mod-uci +ucode-mod-ubus +ucode-mod-uloop +ucode-mod-socket +netifyd
endef

define Package/luci-app-offload-observer/description
Read-only conntrack sampling with Netify application labels. Optional local MMDB countries.
endef

define Package/luci-app-offload-observer/conffiles
/etc/config/offload_observer
endef

define Build/Compile
endef

define Package/luci-app-offload-observer/install
	$(CP) ./root/* $(1)/
	chmod 755 $(1)/usr/sbin/offload-observer $(1)/etc/init.d/offload-observer
endef

$(eval $(call BuildPackage,luci-app-offload-observer))
