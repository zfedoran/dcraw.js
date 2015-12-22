SRCDIR  = src
OBJDIR  = bin
DISTDIR = dist

SRCS    := $(shell find $(SRCDIR) -name '*.c*')
SRCDIRS := $(shell find . -name '*.c*' -exec dirname {} \; | uniq)
TEMP    := $(patsubst %.cpp,$(OBJDIR)/%.o,$(SRCS))
OBJS    := $(patsubst %.c,$(OBJDIR)/%.o,$(TEMP))

APPS =  $(DISTDIR)/dcraw.js

target: $(DISTDIR)/dcraw.js
all: buildrepo $(APPS)

EMFLAGS = -s USE_ZLIB=1 \
		-s ALLOW_MEMORY_GROWTH=1 \
		-s TOTAL_MEMORY=134217728 \
		-s NO_EXIT_RUNTIME=1 \
		-s FORCE_FILESYSTEM=1 \
		-s EXPORT_NAME="'dcraw'" \
		-s NODEJS_CATCH_EXIT=1 \
		-s INVOKE_RUN=0 \
		-s MODULARIZE=1 \
		--memory-init-file 0 \
		--pre-js js-wrapper.js \
		-O3

# DCRAW
CFLAGS = -DNODEPS=1
$(DISTDIR)/dcraw.js : $(OBJS)
	emcc --bind $(OBJS) -o $@ \
		-s EXPORTED_FUNCTIONS="[ '_main' ]" \
		$(EMFLAGS)
	@$(call make-module, $@)

$(OBJDIR)/%.o: %.c
	echo $<
	emcc -s USE_ZLIB=1 $(CFLAGS) --bind $< -o $@

$(OBJDIR)/%.o: %.cpp
	emcc -s USE_ZLIB=1 $(CFLAGS) --bind -std=c++11 $< -o $@

clean: distclean
	$(RM) $(OBJS)

distclean:
	$(RM) $(APPS)

buildrepo:
	@$(call make-repo)


define make-repo
	mkdir -p $(DISTDIR); \
	for dir in $(SRCDIRS); \
	do \
		mkdir -p $(OBJDIR)/$$dir; \
	done
endef

define make-module
	echo 'if (dcraw) { const em_module = dcraw; dcraw = function() { return em_module().dcraw.apply(this, arguments); }; if (typeof module === "object" && module.exports) { module.exports = dcraw; } }' >> $(1);
endef
