import type { USyncQueryProtocol } from '../../Types/USync.js'
import { assertNodeErrorFree, type BinaryNode } from '../../WABinary/index.js'
import { USyncUser } from '../USyncUser.js'

export class USyncContactProtocol implements USyncQueryProtocol {
	name = 'contact'

	getQueryElement(): BinaryNode {
		return {
			tag: 'contact',
			attrs: {}
		}
	}

	getUserElement(user: USyncUser): BinaryNode {
		//TODO: Implement type / username fields (not yet supported)
		return {
			tag: 'contact',
			attrs: {},
			content: user.phone
		}
	}

	parser(node: BinaryNode): boolean {
		if (node.tag === 'contact') {
			assertNodeErrorFree(node)
			return node?.attrs?.type === 'in'
		}

		return false
	}
}
