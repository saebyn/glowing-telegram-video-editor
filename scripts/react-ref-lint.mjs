const refFactories = new Set(["useRef", "createRef"]);

export default {
  rules: {
    "ref-suffix": {
      create(context) {
        function reactImport(identifier) {
          for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
            const variable = scope.set.get(identifier.name);
            if (!variable) continue;
            const definition = variable.defs[0];
            if (
              definition?.type === "ImportBinding" &&
              definition.parent.source.value === "react"
            ) {
              return definition.node;
            }
            return;
          }
        }

        return {
          VariableDeclarator({ id, init }) {
            if (
              id.type !== "Identifier" ||
              id.name.endsWith("Ref") ||
              init?.type !== "CallExpression"
            ) {
              return;
            }
            const { callee } = init;
            let factory;
            if (callee.type === "Identifier") {
              const binding = reactImport(callee);
              if (binding?.type === "ImportSpecifier") factory = binding.imported.name;
            } else if (callee.type === "MemberExpression" && callee.object.type === "Identifier") {
              const binding = reactImport(callee.object);
              if (
                binding?.type === "ImportDefaultSpecifier" ||
                binding?.type === "ImportNamespaceSpecifier"
              ) {
                factory = callee.computed ? callee.property.value : callee.property.name;
              }
            }
            if (refFactories.has(factory)) {
              context.report({
                node: id,
                message: "Name React ref variables with a `Ref` suffix.",
              });
            }
          },
        };
      },
    },
  },
};
