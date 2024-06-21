import { createRemoteFileNode } from 'gatsby-source-filesystem';
import traverse from 'traverse';

const defaultOptions = {
  models: ['Page'],
  shouldDownload: (field, _parent) => {
    return typeof field === 'string' && field.startsWith('https://cdn.builder.io/api/v1/image');
  }
}

// See https://www.gatsbyjs.com/docs/reference/release-notes/migrating-source-plugin-from-v3-to-v4/#2-data-mutations-need-to-happen-during-sourcenodes-or-oncreatenode

export const createSchemaCustomization = ({ actions }) => {
  const { createTypes } = actions;

  createTypes(`
    type CustomImage implements Node {
      localImage: File @link
    }
  `)
}

//create the nodes for each image
export const sourceNodes = async ({
  actions,
  createNodeId,
  createContentDigest,
  store,
  cache,
  reporter,
}) => {
  const { createNode } = actions

  const config = {
    ...defaultOptions,
    ...options,
  };
  // code to fetch data

  for (const model of config.models) {
    // FIXME where do we get source from?
    traverse(source.content.data).forEach(async function (field) {
      if (config.shouldDownload(field, this.parent)) {
        const nodeId = createNodeId(`my-data-${field}`)
        const url = decodeURI(field);
        const image = await createRemoteFileNode({
          url,
          store,
          cache,
          createNode,
          createNodeId,
          reporter,
        });
        const node = {
          id: nodeId,
          parent: null,
          children: [],
          url,
          localImageId: image.id,
          internal: {
            type: `CustomImage`,
            content: url,
            contentDigest: createContentDigest(url),
          },
        }

        createNode(node)
      }
    })
  }
}

// take out createRemoteFileNodes and just do the url replacement
// with the nodes created above.
// Caveat: how to know which node to substitute
export const createResolvers = (
  {
    actions: { createNode },
    cache,
    createNodeId,
    createResolvers,
    pathPrefix,
    store,
    reporter,
  },
  options
) => {
  const config = {
    ...defaultOptions,
    ...options,
  };
  const resolvers = config.models.reduce(
    (acc, model) => ({
      ...acc,
      [`builder_${model}`]: {
        localFiles: {
          type: '[File]',
          resolve: source => {
            const promises = []
            traverse(source.content.data).forEach(function (field) {
              if (config.shouldDownload(field, this.parent)) {
                const object = this;
                promises.push(
                  // createRemoteFileNode({
                  //   url: decodeURI(field),
                  //   store,
                  //   cache,
                  //   createNode,
                  //   createNodeId,
                  //   reporter,
                  // }).then((node) => {
                  () => {
                    if (config.replaceLinksToStatic) {
                      // TODO find which node from sourceNodes is linked to this content
                      const imageName = `${node.name}-${node.internal.contentDigest}${node.ext}`
                      const path = `${pathPrefix}/static/${encodeURI(imageName)}`
                      if (config.debug) {
                        console.log('updating field: ', field, ' to ', path)
                      }
                      object.update(path);
                    }
                    return node
                  }
                )
              }
            })
            if (config.debug) {
              console.log(`downloaded ${promises.length} images from content ${source.content.id} on model ${model}` )
            }
            return Promise.all(promises)
          },
        },
      },
    }),
    {}
  )
  createResolvers(resolvers)
};
