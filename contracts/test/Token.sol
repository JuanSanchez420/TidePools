//SPDX-License-Identifier: Unlicense
pragma solidity =0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {

    uint8 private d;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol){
        d = _decimals;
        _mint(msg.sender, 10000000 * (10 ** 18));  
    }

    function decimals() public view override returns (uint8) {
        return d;
    }

    function mint(address _to, uint _value) public {
        _mint(_to, _value);
    }

    function burn(address _from, uint _value) public {
        _burn(_from, _value);
    }
}